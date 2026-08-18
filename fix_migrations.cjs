const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, 'supabase', 'migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

for (const file of files) {
  const filePath = path.join(migrationsDir, file);
  let sql = fs.readFileSync(filePath, 'utf8');

  // 1. CREATE TYPE -> DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  sql = sql.replace(/^(CREATE TYPE [^;]+);/gim, (match) => {
    return `DO $$ BEGIN\n  ${match}\nEXCEPTION WHEN duplicate_object THEN NULL; END $$;`;
  });

  // 2. CREATE TABLE -> CREATE TABLE IF NOT EXISTS
  sql = sql.replace(/^CREATE TABLE (?!IF NOT EXISTS)([^;]+?\()/gim, 'CREATE TABLE IF NOT EXISTS $1');

  // 3. CREATE INDEX -> CREATE INDEX IF NOT EXISTS
  sql = sql.replace(/^CREATE INDEX (?!IF NOT EXISTS)([^;]+? ON [^;]+);/gim, 'CREATE INDEX IF NOT EXISTS $1;');
  sql = sql.replace(/^CREATE UNIQUE INDEX (?!IF NOT EXISTS)([^;]+? ON [^;]+);/gim, 'CREATE UNIQUE INDEX IF NOT EXISTS $1;');

  // 4. CREATE POLICY -> DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  sql = sql.replace(/^(CREATE POLICY [^;]+);/gim, (match) => {
    return `DO $$ BEGIN\n  ${match}\nEXCEPTION WHEN duplicate_object THEN NULL; END $$;`;
  });

  // 5. CREATE TRIGGER -> DROP TRIGGER IF EXISTS then CREATE TRIGGER
  sql = sql.replace(/^(CREATE TRIGGER ([a-zA-Z0-9_]+) [^;]+);/gim, (match, p1, p2) => {
    // If there's already a drop trigger right before it, skip
    return `DROP TRIGGER IF EXISTS ${p2} ON public.${p2} CASCADE; /* Note: manual check needed for table name, using safer approach */\nDO $$ BEGIN\n  ${p1}\nEXCEPTION WHEN duplicate_object THEN NULL; END $$;`;
  });

  // Quick fix for the trigger regex to just wrap in DO block instead of dropping
  sql = sql.replace(/DROP TRIGGER IF EXISTS.*?DO \$\$ BEGIN\n\s+(CREATE TRIGGER [^;]+;)\nEXCEPTION.*?END \$\$;/gis, 
    "DO $$ BEGIN\n  $1\nEXCEPTION WHEN duplicate_object THEN NULL; END $$;"
  );

  // 6. Fix REVOKE / GRANT on functions in 20260818070734
  if (file === '20260818070734_b7fa82b5-0c0a-404c-bbfe-acb258e6932f.sql') {
    sql = `DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_mutual') THEN
    REVOKE ALL ON FUNCTION public.is_mutual(uuid, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.is_mutual(uuid, uuid) TO authenticated, service_role;
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_view_author') THEN
    REVOKE ALL ON FUNCTION public.can_view_author(uuid, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.can_view_author(uuid, uuid) TO authenticated, service_role;
  END IF;
END $$;`;
  }

  // Ensure 20260818070659 has the function creation safe
  // CREATE OR REPLACE FUNCTION is already safe.

  fs.writeFileSync(filePath, sql, 'utf8');
}

console.log('Migrations modified to be idempotent.');
