package api

import (
	"context"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"google.golang.org/protobuf/types/known/timestamppb"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type AccountService struct {
	DB   *db.Queries
	Pool *pgxpool.Pool
}

func (s *AccountService) CreateAccount(ctx context.Context, req *connect.Request[pb.CreateAccountRequest]) (*connect.Response[pb.CreateAccountResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	account, err := s.DB.CreateFinancialAccount(ctx, db.CreateFinancialAccountParams{
		UserID:              userUUID,
		AccountType:         req.Msg.AccountType,
		InstitutionName:     req.Msg.InstitutionName,
		AccountName:         req.Msg.AccountName,
		MaskedAccountNumber: optionalText(req.Msg.MaskedAccountNumber),
		BalancePaise:        req.Msg.BalancePaise,
		Currency:            req.Msg.Currency,
		IsManual:            true, // Manual by default for now
		ProviderName:        pgtype.Text{},
		ProviderAccountID:   pgtype.Text{},
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.CreateAccountResponse{
		Account: mapFinancialAccount(account),
	}), nil
}

func (s *AccountService) ListAccounts(ctx context.Context, req *connect.Request[pb.ListAccountsRequest]) (*connect.Response[pb.ListAccountsResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	accounts, err := s.DB.ListFinancialAccounts(ctx, userUUID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	mapped := make([]*pb.FinancialAccount, len(accounts))
	for i, a := range accounts {
		mapped[i] = mapFinancialAccount(a)
	}

	return connect.NewResponse(&pb.ListAccountsResponse{
		Accounts: mapped,
	}), nil
}

func (s *AccountService) UpdateAccount(ctx context.Context, req *connect.Request[pb.UpdateAccountRequest]) (*connect.Response[pb.UpdateAccountResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	accUUID, err := parseUUID(req.Msg.Id, "account_id")
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	account, err := s.DB.UpdateFinancialAccount(ctx, db.UpdateFinancialAccountParams{
		ID:                  accUUID,
		UserID:              userUUID,
		AccountType:         optionalText(req.Msg.AccountType),
		InstitutionName:     optionalText(req.Msg.InstitutionName),
		AccountName:         optionalText(req.Msg.AccountName),
		MaskedAccountNumber: optionalText(req.Msg.MaskedAccountNumber),
		BalancePaise:        optionalInt8(req.Msg.BalancePaise),
		Currency:            optionalText(req.Msg.Currency),
		LastSyncedAt:        pgtype.Timestamptz{},
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UpdateAccountResponse{
		Account: mapFinancialAccount(account),
	}), nil
}

func (s *AccountService) DeleteAccount(ctx context.Context, req *connect.Request[pb.DeleteAccountRequest]) (*connect.Response[pb.DeleteAccountResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	accUUID, err := parseUUID(req.Msg.Id, "account_id")
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	err = s.DB.DeleteFinancialAccount(ctx, db.DeleteFinancialAccountParams{
		ID:     accUUID,
		UserID: userUUID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.DeleteAccountResponse{}), nil
}

func (s *AccountService) CreateLiability(ctx context.Context, req *connect.Request[pb.CreateLiabilityRequest]) (*connect.Response[pb.CreateLiabilityResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	accUUID, _ := parseRawUUID(req.Msg.GetAccountId())

	liability, err := s.DB.CreateLiability(ctx, db.CreateLiabilityParams{
		UserID:           userUUID,
		AccountID:        accUUID,
		LiabilityType:    req.Msg.LiabilityType,
		PrincipalPaise:   req.Msg.PrincipalPaise,
		OutstandingPaise: req.Msg.OutstandingPaise,
		InterestRateBps:  optionalInt4(req.Msg.InterestRateBps),
		EmiPaise:         optionalInt8(req.Msg.EmiPaise),
		DueDay:           optionalInt4(req.Msg.DueDay),
		StartDate:        optionalTimestampValue(req.Msg.StartDate),
		EndDate:          optionalTimestampValue(req.Msg.EndDate),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// Trigger achievement
	go func(u pgtype.UUID) {
		_ = awardAchievementIfEligible(context.Background(), s.DB, u, "DEBT_FIGHTER")
	}(userUUID)

	return connect.NewResponse(&pb.CreateLiabilityResponse{
		Liability: mapLiability(liability),
	}), nil
}

func (s *AccountService) ListLiabilities(ctx context.Context, req *connect.Request[pb.ListLiabilitiesRequest]) (*connect.Response[pb.ListLiabilitiesResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	liabs, err := s.DB.ListLiabilities(ctx, userUUID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	mapped := make([]*pb.Liability, len(liabs))
	for i, l := range liabs {
		mapped[i] = mapLiability(l)
	}

	return connect.NewResponse(&pb.ListLiabilitiesResponse{
		Liabilities: mapped,
	}), nil
}

func (s *AccountService) UpdateLiability(ctx context.Context, req *connect.Request[pb.UpdateLiabilityRequest]) (*connect.Response[pb.UpdateLiabilityResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	liabUUID, err := parseUUID(req.Msg.Id, "liability_id")
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	accUUID, _ := parseRawUUID(req.Msg.GetAccountId())

	liability, err := s.DB.UpdateLiability(ctx, db.UpdateLiabilityParams{
		ID:               liabUUID,
		UserID:           userUUID,
		AccountID:        accUUID,
		LiabilityType:    optionalText(req.Msg.LiabilityType),
		PrincipalPaise:   optionalInt8(req.Msg.PrincipalPaise),
		OutstandingPaise: optionalInt8(req.Msg.OutstandingPaise),
		InterestRateBps:  optionalInt4(req.Msg.InterestRateBps),
		EmiPaise:         optionalInt8(req.Msg.EmiPaise),
		DueDay:           optionalInt4(req.Msg.DueDay),
		StartDate:        optionalTimestampValue(req.Msg.StartDate),
		EndDate:          optionalTimestampValue(req.Msg.EndDate),
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.UpdateLiabilityResponse{
		Liability: mapLiability(liability),
	}), nil
}

func (s *AccountService) DeleteLiability(ctx context.Context, req *connect.Request[pb.DeleteLiabilityRequest]) (*connect.Response[pb.DeleteLiabilityResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	liabUUID, err := parseUUID(req.Msg.Id, "liability_id")
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	err = s.DB.DeleteLiability(ctx, db.DeleteLiabilityParams{
		ID:     liabUUID,
		UserID: userUUID,
	})
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&pb.DeleteLiabilityResponse{}), nil
}

func (s *AccountService) GetNetWorthSummary(ctx context.Context, req *connect.Request[pb.GetNetWorthSummaryRequest]) (*connect.Response[pb.GetNetWorthSummaryResponse], error) {
	userUUID, err := authenticatedUserUUID(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	summary, err := s.DB.GetNetWorthSummary(ctx, userUUID)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	assets := summary.TotalAssetsPaise
	liabilities := summary.TotalLiabilitiesPaise
	netWorth := assets - liabilities

	return connect.NewResponse(&pb.GetNetWorthSummaryResponse{
		TotalAssetsPaise:      assets,
		TotalLiabilitiesPaise: liabilities,
		NetWorthPaise:         netWorth,
	}), nil
}

func optionalInt4(value *int32) pgtype.Int4 {
	if value == nil {
		return pgtype.Int4{}
	}
	return pgtype.Int4{Int32: *value, Valid: true}
}

func mapFinancialAccount(a db.FinancialAccount) *pb.FinancialAccount {
	mapped := &pb.FinancialAccount{
		Id:              UUIDToString(a.ID),
		AccountType:     a.AccountType,
		InstitutionName: a.InstitutionName,
		AccountName:     a.AccountName,
		BalancePaise:    a.BalancePaise,
		Currency:        a.Currency,
		IsManual:        a.IsManual,
	}
	if a.MaskedAccountNumber.Valid {
		mapped.MaskedAccountNumber = &a.MaskedAccountNumber.String
	}
	if a.ProviderName.Valid {
		mapped.ProviderName = &a.ProviderName.String
	}
	if a.ProviderAccountID.Valid {
		mapped.ProviderAccountId = &a.ProviderAccountID.String
	}
	if a.LastSyncedAt.Valid {
		mapped.LastSyncedAt = timestamppb.New(a.LastSyncedAt.Time)
	}
	if a.BalanceAsOf.Valid {
		mapped.BalanceAsOf = timestamppb.New(a.BalanceAsOf.Time)
	}
	mapped.BalanceSource = a.BalanceSource
	if a.CreatedAt.Valid {
		mapped.CreatedAt = timestamppb.New(a.CreatedAt.Time)
	}
	if a.UpdatedAt.Valid {
		mapped.UpdatedAt = timestamppb.New(a.UpdatedAt.Time)
	}
	return mapped
}

func mapLiability(l db.Liability) *pb.Liability {
	mapped := &pb.Liability{
		Id:               UUIDToString(l.ID),
		LiabilityType:    l.LiabilityType,
		PrincipalPaise:   l.PrincipalPaise,
		OutstandingPaise: l.OutstandingPaise,
	}
	if l.AccountID.Valid {
		str := UUIDToString(l.AccountID)
		mapped.AccountId = &str
	}
	if l.InterestRateBps.Valid {
		mapped.InterestRateBps = &l.InterestRateBps.Int32
	}
	if l.EmiPaise.Valid {
		mapped.EmiPaise = &l.EmiPaise.Int64
	}
	if l.DueDay.Valid {
		mapped.DueDay = &l.DueDay.Int32
	}
	if l.StartDate.Valid {
		mapped.StartDate = timestamppb.New(l.StartDate.Time)
	}
	if l.EndDate.Valid {
		mapped.EndDate = timestamppb.New(l.EndDate.Time)
	}
	if l.CreatedAt.Valid {
		mapped.CreatedAt = timestamppb.New(l.CreatedAt.Time)
	}
	if l.UpdatedAt.Valid {
		mapped.UpdatedAt = timestamppb.New(l.UpdatedAt.Time)
	}
	return mapped
}
