"""
Consolidated database setup script for chat application.
"""

import os
import psycopg2
import time
import argparse

DB_CONNECTION_STRING = "GET-IT-FROM-SUPERBASE"
SETUP_SQL = """
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversation_participants CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message TEXT,
  last_message_time TIMESTAMP WITH TIME ZONE
);

CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(conversation_id, profile_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  is_received BOOLEAN DEFAULT FALSE,
  received_at TIMESTAMP WITH TIME ZONE,
  is_delivered BOOLEAN DEFAULT FALSE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_policy" ON profiles;
CREATE POLICY "profiles_policy" ON profiles USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "conversations_policy" ON conversations;
CREATE POLICY "conversations_policy" ON conversations USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "conversation_participants_policy" ON conversation_participants;
CREATE POLICY "conversation_participants_policy" ON conversation_participants USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "messages_policy" ON messages;
CREATE POLICY "messages_policy" ON messages USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION update_conversation_on_message_status_change()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_status_update_conversation ON messages;
CREATE TRIGGER message_status_update_conversation
AFTER UPDATE OF is_received, is_delivered, is_read ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message_status_change();
"""

REALTIME_SQL = """
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Table profiles already in publication or other error';
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Table conversations already in publication or other error';
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Table conversation_participants already in publication or other error';
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Table messages already in publication or other error';
  END;
END $$;
"""

ADD_MESSAGE_STATUS_SQL = """
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_received BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS received_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION update_conversation_on_message_status_change()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_status_update_conversation ON messages;
CREATE TRIGGER message_status_update_conversation
AFTER UPDATE OF is_received, is_delivered, is_read ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_on_message_status_change();
"""

def execute_full_setup():
    print("Connecting to database for full setup...")
    
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        conn.autocommit = True
        cursor = conn.cursor()
        
        print("Connection successful. Executing setup script...")
        
        cursor.execute(SETUP_SQL)
        print("Main SQL script executed successfully.")
        
        time.sleep(2)
        
        print("Enabling real-time features...")
        cursor.execute(REALTIME_SQL)
        print("Real-time features enabled successfully.")
        
        cursor.close()
        conn.close()
        
        print("Database setup completed successfully with tables and message status functionality!")
        return True
        
    except Exception as e:
        print(f"Error executing SQL script: {e}")
        return False

def add_message_status_only():
    print("Connecting to database to add message status fields...")
    
    try:
        conn = psycopg2.connect(DB_CONNECTION_STRING)
        conn.autocommit = True
        cursor = conn.cursor()
        
        print("Connection successful. Adding message status fields...")
        
        cursor.execute(ADD_MESSAGE_STATUS_SQL)
        print("Message status fields added successfully.")
        
        time.sleep(1)
        
        print("Ensuring real-time features are enabled...")
        cursor.execute(REALTIME_SQL)
        print("Real-time features configuration completed.")
        
        cursor.close()
        conn.close()
        
        print("Message status fields added successfully!")
        return True
        
    except Exception as e:
        print(f"Error adding message status fields: {e}")
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Database setup for chat application')
    parser.add_argument('--add-status-only', action='store_true', 
                        help='Only add message status fields to existing tables')
    
    args = parser.parse_args()
    
    try:
        import psycopg2
    except ImportError:
        print("psycopg2 is not installed. Installing...")
        os.system("pip install psycopg2-binary")
        print("psycopg2 installed.")
    
    if args.add_status_only:
        add_message_status_only()
    else:
        execute_full_setup()