import { useState } from 'react';
import { signup, login } from '../utils/api';

export default function AuthView({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = mode === 'login'
        ? await login(email.trim(), password)
        : await signup(email.trim(), password, name.trim(), inviteCode.trim());
      onAuthenticated(result);
    } catch (err) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-view">
      <div className="auth-card">
        <img src="/logo_final-removebg-preview.png" alt="Estimia" className="auth-logo" />
        <h2 className="form-title">{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h2>
        <p className="form-sub">
          {mode === 'login'
            ? 'Accède à tes dossiers et ton historique d’estimations.'
            : 'Bêta agents immobiliers — crée ton compte pour démarrer.'}
        </p>

        <form onSubmit={handleSubmit} className="form-body">
          {mode === 'signup' && (
            <div className="form-field">
              <label className="form-label">Nom</label>
              <input
                type="text"
                className="search-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jean Dupont"
                autoComplete="name"
              />
            </div>
          )}

          <div className="form-field">
            <label className="form-label">E-mail</label>
            <input
              type="email"
              className="search-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jean.dupont@agence.fr"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label">Mot de passe</label>
            <input
              type="password"
              className="search-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Au moins 8 caractères' : ''}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'signup' ? 8 : undefined}
              required
            />
          </div>

          {mode === 'signup' && (
            <div className="form-field">
              <label className="form-label">Code d&apos;invitation</label>
              <input
                type="text"
                className="search-input"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                placeholder="Fourni par l'équipe Estimia"
              />
            </div>
          )}

          {error && (
            <div className="state-error">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="13" />
              </svg>
              <div>
                <strong>Erreur</strong>
                <p>{error}</p>
              </div>
            </div>
          )}

          <button type="submit" className="search-btn form-submit" disabled={loading || !email.trim() || !password}>
            {loading ? (
              <>
                <span className="btn-spin" />
                {mode === 'login' ? 'Connexion...' : 'Création...'}
              </>
            ) : (
              mode === 'login' ? 'Se connecter' : 'Créer le compte'
            )}
          </button>
        </form>

        <button
          type="button"
          className="auth-switch"
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(null); }}
        >
          {mode === 'login' ? 'Pas encore de compte ? Inscription' : 'Déjà un compte ? Connexion'}
        </button>
      </div>
    </div>
  );
}
