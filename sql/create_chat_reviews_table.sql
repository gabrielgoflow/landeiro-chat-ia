-- Create chat_reviews table
CREATE TABLE IF NOT EXISTS chat_reviews (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id VARCHAR NOT NULL UNIQUE,
    resumo_atendimento TEXT NOT NULL,
    feedback_direto TEXT NOT NULL,
    sinais_paciente TEXT[] NOT NULL,
    pontos_positivos TEXT[] NOT NULL,
    pontos_negativos TEXT[] NOT NULL,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index on chat_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_chat_reviews_chat_id ON chat_reviews(chat_id);