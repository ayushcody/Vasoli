import crypto from 'node:crypto';

const REQUIRED_SCHEMAS = ['auth', 'public', 'storage', 'supabase_migrations'];
const DEFAULT_OBJECT_TYPES = [
  { code: 'r', keyword: 'TABLES' },
  { code: 'S', keyword: 'SEQUENCES' },
  { code: 'f', keyword: 'FUNCTIONS' },
  { code: 'T', keyword: 'TYPES' },
];
const PRIVILEGES = {
  SCHEMA: new Set(['CREATE', 'USAGE']),
  TABLE: new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']),
  SEQUENCE: new Set(['USAGE', 'SELECT', 'UPDATE']),
  FUNCTION: new Set(['EXECUTE']),
  PROCEDURE: new Set(['EXECUTE']),
  AGGREGATE: new Set(['EXECUTE']),
  TYPE: new Set(['USAGE']),
  TABLES: new Set(['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN']),
  SEQUENCES: new Set(['USAGE', 'SELECT', 'UPDATE']),
  FUNCTIONS: new Set(['EXECUTE']),
  TYPES: new Set(['USAGE']),
};

const ident = (value) => {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) throw new TypeError('Invalid SQL identifier in permission manifest.');
  return `"${value.replaceAll('"', '""')}"`;
};
const literal = (value) => {
  if (typeof value !== 'string' || value.includes('\0')) throw new TypeError('Invalid SQL literal in permission manifest.');
  return `'${value.replaceAll("'", "''")}'`;
};
const qualified = (schema, name) => `${ident(schema)}.${ident(name)}`;

function validateManifest(manifest) {
  if (manifest?.formatVersion !== 1 || !Array.isArray(manifest.schemas) || !Array.isArray(manifest.roles)
    || !Array.isArray(manifest.schemaObjects) || !Array.isArray(manifest.relations) || !Array.isArray(manifest.routines)
    || !Array.isArray(manifest.types) || !Array.isArray(manifest.defaultPrivileges) || !Array.isArray(manifest.memberships) || !Array.isArray(manifest.rls)) {
    throw new TypeError('Unsupported or incomplete permission manifest.');
  }
  for (const name of manifest.schemas) ident(name);
}

function aclSelect(expression, ownerExpression, code, rawCode = false) {
  return `COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'grantee', CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END,
    'grantor', grantor.rolname,
    'privilege', a.privilege_type,
    'grantable', a.is_grantable
  ) ORDER BY grantor.rolname, CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE grantee.rolname END, a.privilege_type, a.is_grantable)
  FROM aclexplode(COALESCE(${expression}, acldefault(${rawCode ? `(${code})::\"char\"` : `${literal(code)}::\"char\"`}, ${ownerExpression}))) a
  LEFT JOIN pg_roles grantee ON grantee.oid=a.grantee
  JOIN pg_roles grantor ON grantor.oid=a.grantor), '[]'::jsonb)`;
}

function normalizeSchemas(schemas) {
  const extra = schemas == null ? [] : (Array.isArray(schemas) ? schemas : [schemas]);
  if (!extra.every((name) => typeof name === 'string' && name.length > 0)) throw new TypeError('schemas must be schema-name strings.');
  return [...new Set([...REQUIRED_SCHEMAS, ...extra])].sort();
}

/** Capture a deterministic, password-free permission manifest from the source database. */
export async function capturePermissions(client, schemas) {
  if (!client || typeof client.query !== 'function') throw new TypeError('A connected PostgreSQL client is required.');
  const schemaNames = normalizeSchemas(schemas);
  const schemaRows = (await client.query(`
    SELECT n.nspname AS name, owner.rolname AS owner,
           ${aclSelect('n.nspacl', 'n.nspowner', 'n')} AS acl
    FROM pg_namespace n JOIN pg_roles owner ON owner.oid=n.nspowner
    WHERE n.nspname=ANY($1::text[])
    ORDER BY n.nspname`, [schemaNames])).rows;
  const presentSchemas = schemaRows.map((row) => row.name);

  const relationRows = (await client.query(`
    SELECT n.nspname AS schema, c.relname AS name,
           CASE WHEN c.relkind='S' THEN 'SEQUENCE' ELSE 'TABLE' END AS kind,
           c.relkind AS relation_kind, owner.rolname AS owner,
           ${aclSelect('c.relacl', 'c.relowner', "CASE WHEN c.relkind='S' THEN 'S' ELSE 'r' END", true)} AS acl
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_roles owner ON owner.oid=c.relowner
    WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p','v','m','S','f')
    ORDER BY n.nspname,c.relname,c.relkind`, [presentSchemas])).rows;

  const routineRows = (await client.query(`
    SELECT n.nspname AS schema, p.proname AS name,
           CASE p.prokind WHEN 'p' THEN 'PROCEDURE' WHEN 'a' THEN 'AGGREGATE' ELSE 'FUNCTION' END AS kind,
           pg_get_function_identity_arguments(p.oid) AS identity_arguments,
           owner.rolname AS owner,
           ${aclSelect('p.proacl', 'p.proowner', 'f')} AS acl
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles owner ON owner.oid=p.proowner
    WHERE n.nspname=ANY($1::text[])
    ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prokind`, [presentSchemas])).rows;

  const typeRows = (await client.query(`
    SELECT n.nspname AS schema, t.typname AS name,
           CASE t.typtype WHEN 'e' THEN 'ENUM' ELSE 'DOMAIN' END AS kind,
           owner.rolname AS owner,
           ${aclSelect('t.typacl', 't.typowner', 'T')} AS acl
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_roles owner ON owner.oid=t.typowner
    WHERE n.nspname=ANY($1::text[]) AND t.typtype IN ('e','d')
    ORDER BY n.nspname,t.typname,t.typtype`, [presentSchemas])).rows;

  const defaultRows = (await client.query(`
    SELECT owner.rolname AS role, NULLIF(n.nspname,'') AS schema,
           d.defaclobjtype AS object_code,
           ${aclSelect('d.defaclacl', 'd.defaclrole', 'd.defaclobjtype', true)} AS acl
    FROM pg_default_acl d JOIN pg_roles owner ON owner.oid=d.defaclrole
    LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
    WHERE d.defaclnamespace=0 OR n.nspname=ANY($1::text[])
    ORDER BY owner.rolname,COALESCE(n.nspname,''),d.defaclobjtype`, [presentSchemas])).rows;

  const rlsRows = (await client.query(`
    SELECT n.nspname AS schema, c.relname AS relation,
           c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'name', p.polname,
               'permissive', p.polpermissive,
               'command', p.polcmd,
               'roles', COALESCE((
                 SELECT jsonb_agg(CASE WHEN r.role_oid=0 THEN 'PUBLIC' ELSE role_name.rolname END
                                  ORDER BY CASE WHEN r.role_oid=0 THEN 'PUBLIC' ELSE role_name.rolname END)
                 FROM unnest(p.polroles) AS r(role_oid)
                 LEFT JOIN pg_roles role_name ON role_name.oid=r.role_oid
               ), '[]'::jsonb),
               'using', pg_get_expr(p.polqual,p.polrelid),
               'check', pg_get_expr(p.polwithcheck,p.polrelid)
             ) ORDER BY p.polname)
             FROM pg_policy p WHERE p.polrelid=c.oid
           ), '[]'::jsonb) AS policies
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=ANY($1::text[]) AND c.relkind IN ('r','p','f')
    ORDER BY n.nspname,c.relname`, [presentSchemas])).rows;

  const membershipRows = (await client.query(`
    SELECT granted.rolname AS granted_role, member.rolname AS member_role,
           grantor.rolname AS grantor, m.admin_option, m.inherit_option, m.set_option
    FROM pg_auth_members m
    JOIN pg_roles granted ON granted.oid=m.roleid
    JOIN pg_roles member ON member.oid=m.member
    JOIN pg_roles grantor ON grantor.oid=m.grantor
    ORDER BY granted.rolname,member.rolname,grantor.rolname,m.admin_option,m.inherit_option,m.set_option`)).rows;

  const roleNames = new Set();
  for (const row of schemaRows) {
    roleNames.add(row.owner);
    for (const grant of row.acl) {
      roleNames.add(grant.grantor);
      if (grant.grantee !== 'PUBLIC') roleNames.add(grant.grantee);
    }
  }
  for (const rows of [relationRows, routineRows, typeRows]) {
    for (const row of rows) {
      roleNames.add(row.owner);
      for (const grant of row.acl) {
        roleNames.add(grant.grantor);
        if (grant.grantee !== 'PUBLIC') roleNames.add(grant.grantee);
      }
    }
  }
  for (const row of defaultRows) {
    roleNames.add(row.role);
    for (const grant of row.acl) {
      roleNames.add(grant.grantor);
      if (grant.grantee !== 'PUBLIC') roleNames.add(grant.grantee);
    }
  }
  for (const row of membershipRows) {
    roleNames.add(row.granted_role);
    roleNames.add(row.member_role);
    roleNames.add(row.grantor);
  }
  for (const row of rlsRows) for (const policy of row.policies) for (const role of policy.roles) if (role !== 'PUBLIC') roleNames.add(role);

  const roles = (await client.query(`
    SELECT rolname AS name, rolsuper AS superuser, rolinherit AS inherit,
           rolcreatedb AS create_db, rolcreaterole AS create_role,
           rolreplication AS replication, rolbypassrls AS bypass_rls,
           rolcanlogin AS can_login, rolconnlimit AS connection_limit
    FROM pg_roles
    WHERE rolname NOT LIKE 'pg\\_%' ESCAPE '\\' OR rolname=ANY($1::text[])
    ORDER BY rolname`, [[...roleNames]])).rows;

  const rls = rlsRows.map((row) => ({
    schema: row.schema,
    relation: row.relation,
    enabled: row.enabled,
    forced: row.forced,
    policies: row.policies,
  }));
  const rlsFingerprint = crypto.createHash('sha256').update(JSON.stringify(rls)).digest('hex');
  return {
    formatVersion: 1,
    schemas: presentSchemas,
    roles,
    memberships: membershipRows,
    schemaObjects: schemaRows,
    relations: relationRows,
    routines: routineRows,
    types: typeRows,
    defaultPrivileges: defaultRows,
    rls,
    rlsFingerprint,
  };
}

const objectAddress = (object) => qualified(object.schema, object.name);

function aclEntries(acl, kind) {
  if (!Array.isArray(acl)) throw new TypeError('Invalid ACL list.');
  const allowed = PRIVILEGES[kind];
  if (!allowed) throw new TypeError(`Unsupported ACL object kind: ${kind}`);
  return acl.map((entry) => {
    if (!allowed.has(entry.privilege) || typeof entry.grantee !== 'string'
      || typeof entry.grantor !== 'string' || typeof entry.grantable !== 'boolean') {
      throw new TypeError(`Unsupported ACL entry for ${kind}.`);
    }
    return entry;
  });
}

function granteeSql(grantee) {
  return grantee === 'PUBLIC' ? 'PUBLIC' : ident(grantee);
}

function groupedGrants(acl, kind) {
  const grants = new Map();
  for (const row of aclEntries(acl, kind)) {
    const key = `${row.grantor}\0${row.grantee}\0${row.grantable}`;
    const privileges = grants.get(key) ?? new Set();
    privileges.add(row.privilege);
    grants.set(key, privileges);
  }
  return [...grants.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, privileges]) => {
    const [grantor, grantee, grantableText] = key.split('\0');
    return { grantor, grantee, grantable: grantableText === 'true', privileges: [...privileges].sort() };
  });
}

function revokeBlock(targetQuery, objectSql) {
  const tag = `vasoli_acl_reset_${crypto.createHash('sha256').update(objectSql + targetQuery).digest('hex').slice(0, 12)}`;
  return `DO $${tag}$\nDECLARE grantee_name text;\nBEGIN\n  FOR grantee_name IN ${targetQuery} LOOP\n    IF grantee_name='PUBLIC' THEN\n      EXECUTE format('REVOKE ALL PRIVILEGES ON %s FROM PUBLIC CASCADE',${literal(objectSql)});\n    ELSE\n      EXECUTE format('REVOKE ALL PRIVILEGES ON %s FROM %I CASCADE',${literal(objectSql)},grantee_name);\n    END IF;\n  END LOOP;\nEND\n$${tag}$;`;
}

function resetObjectAcl(object) {
  if (object.kind === 'SCHEMA') {
    return revokeBlock(`SELECT DISTINCT CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END
      FROM pg_namespace n CROSS JOIN LATERAL aclexplode(COALESCE(n.nspacl,acldefault('n'::"char",n.nspowner))) x
      LEFT JOIN pg_roles gr ON gr.oid=x.grantee
      WHERE n.nspname=${literal(object.name)} AND x.grantee<>n.nspowner`, `SCHEMA ${ident(object.name)}`);
  }
  if (object.kind === 'TABLE' || object.kind === 'SEQUENCE') {
    const code = object.kind === 'SEQUENCE' ? 'S' : 'r';
    const relkinds = object.kind === 'SEQUENCE' ? "c.relkind='S'" : "c.relkind IN ('r','p','v','m','f')";
    return revokeBlock(`SELECT DISTINCT CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl,acldefault('${code}'::"char",c.relowner))) x
      LEFT JOIN pg_roles gr ON gr.oid=x.grantee
      WHERE n.nspname=${literal(object.schema)} AND c.relname=${literal(object.name)} AND ${relkinds} AND x.grantee<>c.relowner`, `${object.kind} ${objectAddress(object)}`);
  }
  if (['FUNCTION', 'PROCEDURE', 'AGGREGATE'].includes(object.kind)) {
    const procKind = object.kind === 'PROCEDURE' ? 'p' : object.kind === 'AGGREGATE' ? 'a' : 'f';
    return revokeBlock(`SELECT DISTINCT CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f'::"char",p.proowner))) x
      LEFT JOIN pg_roles gr ON gr.oid=x.grantee
      WHERE n.nspname=${literal(object.schema)} AND p.proname=${literal(object.name)}
        AND pg_get_function_identity_arguments(p.oid)=${literal(object.identity_arguments)} AND p.prokind=${literal(procKind)} AND x.grantee<>p.proowner`, `${object.kind} ${objectAddress(object)}(${object.identity_arguments})`);
  }
  if (object.kind === 'TYPE') {
    return revokeBlock(`SELECT DISTINCT CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END
      FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
      CROSS JOIN LATERAL aclexplode(COALESCE(t.typacl,acldefault('T'::"char",t.typowner))) x
      LEFT JOIN pg_roles gr ON gr.oid=x.grantee
      WHERE n.nspname=${literal(object.schema)} AND t.typname=${literal(object.name)} AND t.typtype IN ('e','d') AND x.grantee<>t.typowner`, `TYPE ${objectAddress(object)}`);
  }
  throw new TypeError(`Unsupported permission object kind: ${object.kind}`);
}

function ownerSql(object) {
  const owner = ident(object.owner);
  if (object.kind === 'SCHEMA') return `ALTER SCHEMA ${ident(object.name)} OWNER TO ${owner};`;
  if (object.kind === 'SEQUENCE') return `ALTER SEQUENCE ${objectAddress(object)} OWNER TO ${owner};`;
  if (object.kind === 'TABLE') {
    const command = object.relation_kind === 'v' ? 'VIEW'
      : object.relation_kind === 'm' ? 'MATERIALIZED VIEW'
        : object.relation_kind === 'f' ? 'FOREIGN TABLE' : 'TABLE';
    return `ALTER ${command} ${objectAddress(object)} OWNER TO ${owner};`;
  }
  if (object.kind === 'TYPE') return `ALTER TYPE ${objectAddress(object)} OWNER TO ${owner};`;
  if (['FUNCTION', 'PROCEDURE', 'AGGREGATE'].includes(object.kind)) {
    return `ALTER ${object.kind} ${objectAddress(object)}(${object.identity_arguments}) OWNER TO ${owner};`;
  }
  throw new TypeError(`Unsupported owner kind: ${object.kind}`);
}

function grantStatements(kind, owner, acl, objectSql) {
  const statements = [];
  const grantKind = kind === 'AGGREGATE' ? 'FUNCTION' : kind;
  for (const grant of groupedGrants(acl, kind)) {
    if (grant.grantee === owner) continue;
    statements.push(`SET LOCAL ROLE ${ident(grant.grantor)};`);
    statements.push(`GRANT ${grant.privileges.join(', ')} ON ${grantKind} ${objectSql} TO ${granteeSql(grant.grantee)}${grant.grantable ? ' WITH GRANT OPTION' : ''};`);
    statements.push('RESET ROLE;');
  }
  return statements;
}

function defaultAclResetSql(roles, schemas) {
  const entries = [];
  for (const role of roles) {
    for (const objectType of DEFAULT_OBJECT_TYPES) {
      entries.push({ role: role.name, schema: null, ...objectType });
      for (const schema of schemas) entries.push({ role: role.name, schema, ...objectType });
    }
  }
  const values = entries.map((entry) => `(${literal(entry.role)},${entry.schema == null ? 'NULL' : literal(entry.schema)},${literal(entry.code)},${literal(entry.keyword)})`).join(',\n    ');
  return `DO $vasoli_default_acl_reset$\nDECLARE item record; grantee_name text; scope_sql text;\nBEGIN\n  FOR item IN SELECT * FROM (VALUES\n    ${values}\n  ) AS reset_targets(role_name,schema_name,object_code,object_keyword) LOOP\n    scope_sql := CASE WHEN item.schema_name IS NULL THEN '' ELSE format(' IN SCHEMA %I',item.schema_name) END;\n    FOR grantee_name IN\n      SELECT DISTINCT CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE gr.rolname END\n      FROM pg_default_acl d\n      CROSS JOIN LATERAL aclexplode(COALESCE(d.defaclacl,acldefault(d.defaclobjtype,d.defaclrole))) x\n      LEFT JOIN pg_roles gr ON gr.oid=x.grantee\n      WHERE d.defaclrole=(SELECT oid FROM pg_roles WHERE rolname=item.role_name)\n        AND d.defaclnamespace=CASE WHEN item.schema_name IS NULL THEN 0 ELSE (SELECT oid FROM pg_namespace WHERE nspname=item.schema_name) END\n        AND d.defaclobjtype=item.object_code\n    LOOP\n      IF grantee_name='PUBLIC' THEN\n        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I%s REVOKE ALL ON %s FROM PUBLIC',item.role_name,scope_sql,item.object_keyword);\n      ELSE\n        EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I%s REVOKE ALL ON %s FROM %I',item.role_name,scope_sql,item.object_keyword,grantee_name);\n      END IF;\n    END LOOP;\n  END LOOP;\nEND\n$vasoli_default_acl_reset$;`;
}

function roleCheckSql(roles) {
  const expected = roles.map((role) => ({
    name: role.name,
    superuser: role.superuser,
    inherit: role.inherit,
    create_db: role.create_db,
    create_role: role.create_role,
    replication: role.replication,
    bypass_rls: role.bypass_rls,
    can_login: role.can_login,
    connection_limit: role.connection_limit,
  }));
  return `DO $vasoli_role_check$\nDECLARE expected record; actual record;\nBEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='vasoli_app') THEN\n    CREATE ROLE vasoli_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;\n  END IF;\n  FOR expected IN SELECT * FROM jsonb_to_recordset(${literal(JSON.stringify(expected))}::jsonb) AS x(\n    name text,superuser boolean,inherit boolean,create_db boolean,create_role boolean,replication boolean,bypass_rls boolean,can_login boolean,connection_limit integer\n  ) LOOP\n    SELECT rolsuper,rolinherit,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolcanlogin,rolconnlimit\n      INTO actual FROM pg_roles WHERE rolname=expected.name;\n    IF NOT FOUND THEN RAISE EXCEPTION 'Required source role is missing: %', expected.name; END IF;\n    IF ROW(actual.rolsuper,actual.rolinherit,actual.rolcreatedb,actual.rolcreaterole,actual.rolreplication,actual.rolbypassrls,actual.rolconnlimit)\n       IS DISTINCT FROM ROW(expected.superuser,expected.inherit,expected.create_db,expected.create_role,expected.replication,expected.bypass_rls,expected.connection_limit)\n       OR (actual.rolcanlogin IS DISTINCT FROM expected.can_login AND NOT (expected.name='vasoli_app' AND expected.can_login)) THEN\n      RAISE EXCEPTION 'Role attributes differ from source manifest: %', expected.name;\n    END IF;\n  END LOOP;\n  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='vasoli_app' AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit)) THEN\n    RAISE EXCEPTION 'vasoli_app must remain restricted';\n  END IF;\nEND\n$vasoli_role_check$;`;
}

function roleMembershipSql(memberships) {
  const sql = [];
  for (const membership of memberships.filter((row) => row.granted_role === 'vasoli_app' || row.member_role === 'vasoli_app')) {
    sql.push(`SET LOCAL ROLE ${ident(membership.grantor)};`);
    const options = [
      ...(membership.admin_option ? ['ADMIN OPTION'] : []),
      `INHERIT ${membership.inherit_option ? 'TRUE' : 'FALSE'}`,
      `SET ${membership.set_option ? 'TRUE' : 'FALSE'}`,
    ];
    sql.push(`GRANT ${ident(membership.granted_role)} TO ${ident(membership.member_role)} WITH ${options.join(', ')};`);
    sql.push('RESET ROLE;');
  }
  const expected = literal(JSON.stringify(memberships));
  sql.push(`DO $vasoli_membership_check$\nDECLARE expected jsonb := ${expected}::jsonb; actual jsonb;\nBEGIN\n  SELECT COALESCE(jsonb_agg(jsonb_build_object(\n    'granted_role',granted.rolname,'member_role',member.rolname,'grantor',grantor.rolname,\n    'admin_option',m.admin_option,'inherit_option',m.inherit_option,'set_option',m.set_option\n  ) ORDER BY granted.rolname,member.rolname,grantor.rolname,m.admin_option,m.inherit_option,m.set_option),'[]'::jsonb)\n    INTO actual FROM pg_auth_members m\n    JOIN pg_roles granted ON granted.oid=m.roleid\n    JOIN pg_roles member ON member.oid=m.member\n    JOIN pg_roles grantor ON grantor.oid=m.grantor;\n  IF actual IS DISTINCT FROM expected THEN\n    RAISE EXCEPTION 'Role memberships differ from source manifest';\n  END IF;\nEND\n$vasoli_membership_check$;`);
  return sql;
}

function objectGrantSql(object) {
  if (object.kind === 'SCHEMA') return ident(object.name);
  if (['FUNCTION', 'PROCEDURE', 'AGGREGATE'].includes(object.kind)) return `${objectAddress(object)}(${object.identity_arguments})`;
  return objectAddress(object);
}

/** Return transactional SQL to replay ACLs on a fresh same-version clone. */
export function permissionsSQL(manifest) {
  validateManifest(manifest);
  const objects = [
    ...manifest.schemaObjects.map((row) => ({ ...row, kind: 'SCHEMA' })),
    ...manifest.relations,
    ...manifest.routines,
    ...manifest.types.map((row) => ({ ...row, kind: 'TYPE' })),
  ];
  const sql = ['BEGIN;', roleCheckSql(manifest.roles), ...roleMembershipSql(manifest.memberships)];
  for (const object of objects.filter((value) => value.kind === 'SCHEMA')) sql.push(ownerSql(object));
  for (const object of objects.filter((value) => value.kind !== 'SCHEMA')) sql.push(ownerSql(object));
  for (const object of objects) sql.push(resetObjectAcl(object));
  sql.push(defaultAclResetSql(manifest.roles, manifest.schemas));

  for (const object of objects) {
    const kind = object.kind;
    sql.push(...grantStatements(kind, object.owner, object.acl, objectGrantSql(object)));
  }
  for (const entry of manifest.defaultPrivileges) {
    const keyword = DEFAULT_OBJECT_TYPES.find((value) => value.code === entry.object_code)?.keyword;
    if (!keyword) throw new TypeError(`Unsupported default ACL object code: ${entry.object_code}`);
    const scope = entry.schema == null ? '' : ` IN SCHEMA ${ident(entry.schema)}`;
    for (const grant of groupedGrants(entry.acl, keyword)) {
      sql.push(`SET LOCAL ROLE ${ident(grant.grantor)};`);
      sql.push(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ident(entry.role)}${scope} GRANT ${grant.privileges.join(', ')} ON ${keyword} TO ${granteeSql(grant.grantee)}${grant.grantable ? ' WITH GRANT OPTION' : ''};`);
      sql.push('RESET ROLE;');
    }
  }
  sql.push('COMMIT;');
  return sql.join('\n');
}

export const applyPermissionsSQL = permissionsSQL;
