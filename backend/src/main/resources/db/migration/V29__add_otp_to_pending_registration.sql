-- Ajout des colonnes OTP pour la vérification d'identité du collaborateur
-- L'OTP est généré au moment du clic sur le lien de confirmation (pas à l'invitation)
ALTER TABLE pending_registration
    ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6),
    ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;
