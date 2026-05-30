import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
import SignupForm from '../components/auth/SignupForm';

const LEGAL_CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    body: [
      'We minimize stored data and prioritize private communication. For encrypted direct chats, message content is encrypted on client devices and decrypted on client devices.',
      'Service metadata can include participant IDs, timestamps, delivery/read state, device/session metadata, and abuse report records.',
      'Message records are permanently deleted by policy after 7 days, subject to operational scheduling windows.',
    ],
  },
  terms: {
    title: 'Terms of Service',
    body: [
      'By using this service, you agree to responsible use and compliance with applicable law.',
      'Do not use this service for harassment, hate speech, threats, fraud, impersonation, sexual exploitation, or unlawful activity.',
      'This beta service may change, pause, or be discontinued, and abusive accounts may be suspended.',
    ],
  },
  safety: {
    title: 'Safety',
    body: [
      'Safety is enforced through account controls, reporting, rate limits, and moderation scaffolding.',
      'Use in-app reporting for harassment, threats, impersonation, spam, or policy violations.',
      'Encrypted messaging protects transit and storage but cannot prevent screenshots or compromised devices.',
    ],
  },
  'data-policy': {
    title: 'Data Policy',
    body: [
      'Only data required for authentication, delivery, reliability, and safety workflows is retained.',
      'Messages are scheduled for permanent deletion after 7 days by automated retention jobs.',
      'Operational logs track eligible/deleted counts for retention runs without storing message plaintext.',
    ],
  },
};

const MODAL_KEYS = ['login', 'signup', 'privacy', 'terms', 'safety', 'data-policy'];
const LEGAL_KEYS = ['privacy', 'terms', 'safety', 'data-policy'];

function LandingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryModal = searchParams.get('modal');
  const activeModal = MODAL_KEYS.includes(queryModal) ? queryModal : '';

  const closeModal = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  useEffect(() => {
    if (!activeModal) return undefined;

    function handleEsc(event) {
      if (event.key === 'Escape') {
        closeModal();
      }
    }

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeModal, closeModal]);

  function openModal(name) {
    setSearchParams({ modal: name }, { replace: true });
  }

  const isLegalModalOpen = LEGAL_KEYS.includes(activeModal);
  const legalDoc = isLegalModalOpen ? LEGAL_CONTENT[activeModal] : null;

  return (
    <main className="app-page app-page--marketing landing-wrap">
      <header className="landing-header">
        <div className="landing-inner landing-header-inner">
          <button className="landing-brand landing-brand-btn" type="button" onClick={closeModal}>
            TEXT WEEK
          </button>

          <nav className="landing-top-links landing-header-actions" aria-label="Site links">
            <button className="btn-ghost" type="button" onClick={() => openModal('login')}>
              Sign in
            </button>
            <button className="btn-primary" type="button" onClick={() => openModal('signup')}>
              Get started
            </button>
          </nav>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-inner landing-hero-inner">
          <h1>
            Connect
            <br />
            with the people,
            <br />
            not algorithms.
          </h1>
          <p>Build your profile, discover people by username, and start private conversations.</p>
          <div className="landing-actions">
            <button className="btn-primary" type="button" onClick={() => openModal('signup')}>
              Create account
            </button>
            <button className="btn-secondary" type="button" onClick={() => openModal('login')}>
              Log in
            </button>
          </div>
        </div>
      </section>

      <section className="landing-hero-meta" aria-hidden="true">
        <div className="landing-inner landing-footer-inner">
          <nav className="landing-footer-links" aria-label="Legal links">
            <button type="button" onClick={() => openModal('privacy')}>
              Privacy
            </button>
            <button type="button" onClick={() => openModal('terms')}>
              Terms
            </button>
            <button type="button" onClick={() => openModal('safety')}>
              Safety
            </button>
            <button type="button" onClick={() => openModal('data-policy')}>
              Data Policy
            </button>
          </nav>
        </div>
      </section>

      {activeModal && (
        <section className="landing-modal-backdrop" role="presentation" onClick={closeModal}>
          <article
            className="landing-modal"
            role="dialog"
            aria-modal="true"
            aria-label={isLegalModalOpen ? legalDoc.title : activeModal === 'login' ? 'Log in' : 'Create account'}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="landing-modal-header">
              <h2>{isLegalModalOpen ? legalDoc.title : activeModal === 'login' ? 'Welcome back' : 'Create your account'}</h2>
              <button className="landing-modal-close" type="button" onClick={closeModal} aria-label="Close popout">
                x
              </button>
            </header>

            <div className="landing-modal-body">
              {activeModal === 'login' && <LoginForm />}
              {activeModal === 'signup' && <SignupForm />}
              {isLegalModalOpen &&
                legalDoc.body.map((paragraph) => (
                  <p key={paragraph} className="legal-modal-copy">
                    {paragraph}
                  </p>
                ))}
            </div>
          </article>
        </section>
      )}
    </main>
  );
}

export default LandingPage;
