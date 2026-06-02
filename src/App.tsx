import { useState, useEffect } from 'react';
import { googleSignIn, initAuth, logout } from './firebase';
import { User } from 'firebase/auth';
import { motion } from 'motion/react';
import { Laptop, ArrowRight, Sparkles, User as UserIcon, LogOut, CheckCircle2, ChevronRight, HelpCircle, Loader2 } from 'lucide-react';
import ClientPanel from './components/ClientPanel';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoding, setIsLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [viewAsClient, setViewAsClient] = useState(false);

  useEffect(() => {
    // Listen to Firebase Auth state
    const unsubscribe = initAuth(
      (currentUser, cachedToken) => {
        setUser(currentUser);
        setToken(cachedToken);
        setIsLoading(false);
      },
      () => {
        setUser(null);
        setToken(null);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err) {
      console.error('Sign-in flow error:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('¿Quieres cerrar sesión?')) {
      await logout();
      setUser(null);
      setToken(null);
    }
  };

  const isAdminUser = user?.email === 'erikripoll2012@gmail.com';

  return (
    <div className="min-h-screen flex flex-col font-sans selection:bg-indigo-600 selection:text-white" id="applet-viewport">
      {/* 1. Elegant global navigation bar */}
      <nav className="bg-white border-b border-slate-200 py-3.5 px-6 flex items-center justify-between sticky top-0 z-40 shadow-sm" id="main-nav">
        <div className="flex items-center gap-2.5">
          {/* Logo element resembling the stylized rotate box from Bento template */}
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-display font-bold text-base tracking-tight shadow-sm select-none">
            <div className="w-4 h-4 border-2 border-white rotate-45 flex items-center justify-center">
              <span className="-rotate-45 text-[10px] mb-0.5 ml-0.5 font-sans">P</span>
            </div>
          </div>
          <div>
            <div className="flex items-center">
              <h1 className="font-display font-semibold text-slate-900 text-sm tracking-tight leading-none">Pageify</h1>
              <span className="bg-indigo-50 text-indigo-700 text-[9px] px-2 py-0.5 rounded font-semibold ml-2 border border-indigo-100 hidden sm:inline-block">Firebase Active</span>
            </div>
            <span className="font-sans text-[10px] text-slate-400 font-medium tracking-wide">STUDIO DE WEBS</span>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            {/* If admin is logged in, show toggles to preview as client */}
            {isAdminUser && (
              <div className="hidden sm:flex bg-slate-100 rounded-xl p-0.5 border border-slate-200" id="admin-view-toggle">
                <button
                  onClick={() => setViewAsClient(false)}
                  className={`px-3 py-1 text-[10px] font-sans font-bold rounded-lg transition-all ${
                    !viewAsClient ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Admin Panel
                </button>
                <button
                  onClick={() => setViewAsClient(true)}
                  className={`px-3 py-1 text-[10px] font-sans font-bold rounded-lg transition-all ${
                    viewAsClient ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50' : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  Vista Cliente
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  referrerPolicy="no-referrer"
                  alt="Avatar"
                  className="w-5 h-5 rounded-full border border-slate-300 flex-shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] uppercase font-bold">
                  {user.email?.slice(0, 2)}
                </div>
              )}
              <span className="hidden sm:inline font-sans text-xs text-slate-700 font-medium truncate max-w-[120px]">
                {user.displayName || user.email}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="text-slate-500 hover:text-slate-850 transition-colors p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              title="Cerrar sesión"
              id="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="font-sans font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl active:scale-95 transition-all shadow-sm shadow-indigo-100 cursor-pointer disabled:opacity-50"
            id="nav-login-btn"
          >
            {isLoggingIn ? 'Cargando...' : 'Acceso Directo'}
          </button>
        )}
      </nav>

      {/* 2. Main Page Content with smooth layout transitions */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {isLoding ? (
          <div className="flex flex-col items-center justify-center py-24" id="global-loading">
            <Loader2 className="w-10 h-10 animate-spin text-slate-900 mb-3" />
            <p className="font-sans text-xs text-slate-500">Iniciando Pageify en tu navegador...</p>
          </div>
        ) : !user ? (
          /* Introduction and Landing Page */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-16 py-8"
            id="landing-hero"
          >
            {/* Hero Header component */}
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-sans font-semibold px-3 py-1 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Vendo páginas web completas
              </div>

              <h2 className="font-display font-medium text-slate-900 text-4xl sm:text-5xl lg:text-6xl tracking-tight leading-tight">
                La hacemos para ti. Después tú pagas.
              </h2>

              <p className="font-sans text-sm sm:text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
                Diseñamos y programamos tu página web profesional a medida por tan solo <strong className="text-indigo-600 font-bold">5€</strong>. Pagas cómodamente vía Revolut y chateas directamente con el programador para refinaciones.
              </p>

              {/* Official Google Sign-In Styled button */}
              <div className="pt-4 flex flex-col items-center gap-3">
                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="inline-flex items-center gap-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-sans font-medium text-xs px-5 py-3 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-98 cursor-pointer disabled:opacity-50"
                  id="google-large-gsi-btn"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>Iniciar sesión con Google para solicitar ya</span>
                </button>
                <span className="font-sans text-[10px] text-slate-400">
                  Requiere cuenta válida de correo de Google para administrar tus solicitudes.
                </span>
              </div>
            </div>

            {/* Core Features cards info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto pt-6">
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  5€
                </div>
                <h3 className="font-sans font-semibold text-slate-800 text-sm">Tarifa Plana</h3>
                <p className="font-sans text-xs text-slate-500 leading-relaxed">
                  Web modular y responsive por solo 5€. Pagos ágiles e inmediatos mediante Revolut.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  2€
                </div>
                <h3 className="font-sans font-semibold text-slate-800 text-sm">Cambios Flexibles</h3>
                <p className="font-sans text-xs text-slate-500 leading-relaxed">
                  ¿Quieres añadir nuevas secciones o realizar modificaciones? Solicítalas por solo 2€ extra por vez.
                </p>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  <ChevronRight className="w-4 h-4 text-indigo-600" />
                </div>
                <h3 className="font-sans font-semibold text-slate-800 text-sm">Lanzamiento Directo</h3>
                <p className="font-sans text-xs text-slate-500 leading-relaxed">
                  Cuando el pedido se complete, te entregamos el enlace de visualización y el código HTML empaquetado.
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Logged In Dashboard View */
          <div className="space-y-6" id="dashboard-container">
            {/* Admin vs Client Selector Pills bar */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-display font-semibold text-slate-950 text-xl tracking-tight">
                  {isAdminUser && !viewAsClient ? 'Área de Administración de Pedidos' : 'Panel de Control de Clientes'}
                </h2>
                <p className="font-sans text-xs text-slate-500">
                  {isAdminUser && !viewAsClient
                    ? 'Supervisa ventas, modifica estados y chatea con clientes en directo.'
                    : 'Administra tus solicitudes, chatea con el desarrollador o solicita refinaciones.'}
                </p>
              </div>
              {isAdminUser && (
                <div className="sm:hidden block">
                  <button
                    onClick={() => setViewAsClient(!viewAsClient)}
                    className="font-sans text-xs font-semibold px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                  >
                    {!viewAsClient ? 'Ver Cliente' : 'Ver Admin'}
                  </button>
                </div>
              )}
            </div>

            {isAdminUser && !viewAsClient ? (
              <AdminPanel currentUser={user} />
            ) : (
              <ClientPanel currentUser={user} />
            )}
          </div>
        )}
      </main>

      {/* 3. Footer */}
      <footer className="border-t border-slate-200/60 bg-white py-6 mt-16 text-center text-slate-400 text-[11px] font-sans" id="main-footer">
        <p>© {new Date().getFullYear()} Pageify Studio. Hecho para potenciar tu marca española local.</p>
        <p className="mt-1">Operando de forma segura con Firebase Cloud Storage & Google Suite. Pagos vía Revolut.</p>
      </footer>
    </div>
  );
}
