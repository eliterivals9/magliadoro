-- ============================================================================
-- SUPABASE MIGRATION SCRIPT: SYNC AUTH.USERS -> PUBLIC.PROFILES
-- Elite Tournament Store
-- ============================================================================
-- OBIETTIVO:
-- Analizza tutti gli utenti già registrati in auth.users e popola/aggiorna
-- la tabella public.profiles copiano l'email e il telefono (oltre a nome e cognome).
--
-- REGOLE RISPETTATE:
-- 1. Nessun utente duplicato (chiave primaria id = auth.users.id).
-- 2. Nessuna modifica a password o sessioni di autenticazione.
-- 3. Gli ID rimangono invariati.
-- 4. Se il record in profiles esiste -> UPDATE, altrimenti -> INSERT.
-- 5. Non vengono copiati indirizzo, città, provincia, CAP, paese, avatar.
-- 6. Ogni utente avrà id, nome, cognome, email, telefono in public.profiles.
-- ============================================================================

-- Step 1: Assicurati che la tabella public.profiles esista con i campi necessari
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT DEFAULT '',
  cognome TEXT DEFAULT '',
  email TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Assicura l'esistenza di tutte le colonne richieste senza sovrascrivere dati
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cognome TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telefono TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());

-- Step 2: Abilita RLS e definisci le policy di sicurezza per public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Utenti possono leggere il proprio profilo'
    ) THEN
        CREATE POLICY "Utenti possono leggere il proprio profilo" 
        ON public.profiles FOR SELECT 
        USING (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Utenti possono aggiornare il proprio profilo'
    ) THEN
        CREATE POLICY "Utenti possono aggiornare il proprio profilo" 
        ON public.profiles FOR UPDATE 
        USING (auth.uid() = id) 
        WITH CHECK (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Utenti possono inserire il proprio profilo'
    ) THEN
        CREATE POLICY "Utenti possono inserire il proprio profilo" 
        ON public.profiles FOR INSERT 
        WITH CHECK (auth.uid() = id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Accesso amministrativo totale'
    ) THEN
        CREATE POLICY "Accesso amministrativo totale" 
        ON public.profiles FOR ALL 
        USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Step 3: Funzione Stored Procedure (RPC) per eseguire la migrazione in modo sicuro
CREATE OR REPLACE FUNCTION public.migrate_users_to_profiles()
RETURNS JSONB AS $$
DECLARE
  v_inserted INT := 0;
  v_updated INT := 0;
  v_total INT := 0;
BEGIN
  SELECT COUNT(*) INTO v_total FROM auth.users;

  -- Esegui l'UPSERT da auth.users a public.profiles
  INSERT INTO public.profiles (
    id,
    email,
    telefono,
    nome,
    cognome,
    updated_at
  )
  SELECT 
    u.id,
    COALESCE(u.email, ''),
    COALESCE(
      u.raw_user_meta_data->>'telefono',
      u.raw_user_meta_data->>'phone',
      u.raw_user_meta_data->>'cellulare',
      u.raw_user_meta_data->>'mobile',
      ''
    ) AS telefono,
    COALESCE(
      u.raw_user_meta_data->>'nome',
      u.raw_user_meta_data->>'first_name',
      u.raw_user_meta_data->>'name',
      ''
    ) AS nome,
    COALESCE(
      u.raw_user_meta_data->>'cognome',
      u.raw_user_meta_data->>'last_name',
      ''
    ) AS cognome,
    NOW() AS updated_at
  FROM auth.users u
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    telefono = CASE 
      WHEN EXCLUDED.telefono IS NOT NULL AND EXCLUDED.telefono <> '' THEN EXCLUDED.telefono 
      ELSE public.profiles.telefono 
    END,
    nome = CASE 
      WHEN EXCLUDED.nome IS NOT NULL AND EXCLUDED.nome <> '' THEN EXCLUDED.nome 
      ELSE public.profiles.nome 
    END,
    cognome = CASE 
      WHEN EXCLUDED.cognome IS NOT NULL AND EXCLUDED.cognome <> '' THEN EXCLUDED.cognome 
      ELSE public.profiles.cognome 
    END,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'total_auth_users', v_total,
    'message', 'Migrazione completata con successo.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Esegui subito la funzione di migrazione
SELECT public.migrate_users_to_profiles();

-- Step 5: Trigger automatico per sincronizzare automaticamente ogni nuovo utente futuro
CREATE OR REPLACE FUNCTION public.handle_new_user_profile_sync()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, telefono, nome, cognome, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'telefono',
      NEW.raw_user_meta_data->>'phone',
      ''
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'nome',
      NEW.raw_user_meta_data->>'first_name',
      ''
    ),
    COALESCE(
      NEW.raw_user_meta_data->>'cognome',
      NEW.raw_user_meta_data->>'last_name',
      ''
    ),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    telefono = CASE 
      WHEN EXCLUDED.telefono IS NOT NULL AND EXCLUDED.telefono <> '' THEN EXCLUDED.telefono 
      ELSE public.profiles.telefono 
    END,
    nome = CASE 
      WHEN EXCLUDED.nome IS NOT NULL AND EXCLUDED.nome <> '' THEN EXCLUDED.nome 
      ELSE public.profiles.nome 
    END,
    cognome = CASE 
      WHEN EXCLUDED.cognome IS NOT NULL AND EXCLUDED.cognome <> '' THEN EXCLUDED.cognome 
      ELSE public.profiles.cognome 
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile_sync();
