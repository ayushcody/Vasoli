package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"

	"connectrpc.com/connect"
	"github.com/jackc/pgx/v5/pgtype"

	"vasoli-backend/internal/db"
	pb "vasoli-backend/internal/gen/vasoli/v1"
)

type ImportService struct {
	DB *db.Queries
}

func (s *ImportService) ImportStatement(ctx context.Context, req *connect.Request[pb.ImportStatementRequest]) (*connect.Response[pb.ImportStatementResponse], error) {
	userID, err := UserIDFromContext(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeUnauthenticated, err)
	}

	var userUUID pgtype.UUID
	if err := userUUID.Scan(userID); err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	hash := sha256.Sum256(req.Msg.File)
	hashStr := hex.EncodeToString(hash[:])

	// Create import batch (will fail on duplicate hash due to UNIQUE constraint)
	batch, err := s.DB.CreateImportBatch(ctx, db.CreateImportBatchParams{
		UserID:     userUUID,
		FileHash:   hashStr,
		BankFormat: req.Msg.Format,
	})

	if err != nil {
		return nil, connect.NewError(connect.CodeAlreadyExists, err)
	}

	idStr := UUIDToString(batch.ID)

	// Since we are not doing a full CSV parse here for MVP, return 0 initially, 
	// or assume the Frontend continues doing some mappings beforehand
	return connect.NewResponse(&pb.ImportStatementResponse{
		BatchId:      idStr,
		ParsedCount:  0,
		CreatedCount: 0,
		MatchedCount: 0,
	}), nil
}
