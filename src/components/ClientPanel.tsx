import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError } from '../firebase';
import { collection, query, where, getDocs, setDoc, updateDoc, doc, serverTimestamp, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { Order, OperationType, ProgressStatus } from '../types';
import { User } from 'firebase/auth';
import { CirclePlus, Loader2, CreditCard, Send, CheckCircle2, RefreshCw, Layers, Copy, ExternalLink, HelpCircle } from 'lucide-react';
import ActiveChat from './ActiveChat';

interface ClientPanelProps {
  currentUser: User;
}

export default function ClientPanel({ currentUser }: ClientPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'mis_pedidos' | 'nuevo_pedido'>('mis_pedidos');

  // New Order Form state
  const [formName, setFormName] = useState(currentUser.displayName || '');
  const [formPhone, setFormPhone] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);

  // Selected order details
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Changes request Form State
  const [changesText, setChangesText] = useState('');
  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [changesError, setChangesError] = useState<string | null>(null);
  const [showChangesModal, setShowChangesModal] = useState(false);

  // Copy code indicator
  const [copied, setCopied] = useState(false);

  // Listen to owner orders
  useEffect(() => {
    setLoading(true);
    const ordersCollectionPath = 'orders';
    const q = query(
      collection(db, 'orders'),
      where('clientId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: Order[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loaded.push({
            id: docSnap.id,
            clientId: data.clientId,
            clientEmail: data.clientEmail,
            clientPhone: data.clientPhone,
            clientName: data.clientName,
            description: data.description,
            price: data.price,
            progressStatus: data.progressStatus,
            paymentStatus: data.paymentStatus,
            resultUrl: data.resultUrl,
            resultCode: data.resultCode,
            changesCount: data.changesCount || 0,
            changesDescription: data.changesDescription || '',
            createdAt: data.createdAt ? (data.createdAt.seconds ? new Date(data.createdAt.seconds * 1000).toISOString() : new Date(data.createdAt).toISOString()) : new Date().toISOString(),
            updatedAt: data.updatedAt ? (data.updatedAt.seconds ? new Date(data.updatedAt.seconds * 1000).toISOString() : new Date(data.updatedAt).toISOString()) : new Date().toISOString(),
          });
        });
        setOrders(loaded);
        if (loaded.length > 0 && !selectedOrderId) {
          setSelectedOrderId(loaded[0].id);
        }
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, ordersCollectionPath);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser.uid]);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  // Create order
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim() || !formDescription.trim()) {
      setFormError('Por favor, rellena todos los campos del formulario.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const ordersCollectionPath = 'orders';
    const newOrderDocRef = doc(collection(db, 'orders'));
    const generatedId = newOrderDocRef.id;

    const payload = {
      id: generatedId,
      clientId: currentUser.uid,
      clientEmail: currentUser.email || '',
      clientPhone: formPhone.trim(),
      clientName: formName.trim(),
      description: formDescription.trim(),
      price: 5, // initial price is exactly 5€ as per rules/requirements
      progressStatus: 'en_espera' as const,
      paymentStatus: 'pendiente' as const,
      changesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(newOrderDocRef, payload);
      setFormDescription('');
      setFormSuccess(true);
      setActiveTab('mis_pedidos');
      setSelectedOrderId(generatedId);
      // Create initial automatic bot greeting in chat to welcome
      await addDoc(collection(db, 'orders', generatedId, 'messages'), {
        senderId: 'system_bot',
        senderName: 'Pageify Bot',
        text: `¡Hola ${formName.trim()}! He recibido tu solicitud para construir tu sitio web. El costo base del pedido es de 5€. Por favor realiza el pago usando Revolut para empezar con tu desarrollo.`,
        createdAt: serverTimestamp()
      });
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.CREATE, ordersCollectionPath);
      setFormError('No se pudo procesar tu pedido. Comprueba la configuración de base de datos.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Client requests adjustments (+2€)
  const handleRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !changesText.trim()) return;

    setIsRequestingChanges(true);
    setChangesError(null);

    const orderDocRef = doc(db, 'orders', selectedOrder.id);
    const orderPath = `orders/${selectedOrder.id}`;

    // Compute increments exactly as allowed in Firestore rules:
    // incoming().changesCount == existing().changesCount + 1
    // incoming().price == existing().price + 2
    // incoming().progressStatus == "cambios_solicitados"
    // and exact keys diff: changesCount, changesDescription, progressStatus, price, updatedAt
    const nextChangesCount = selectedOrder.changesCount + 1;
    const nextPrice = selectedOrder.price + 2;

    try {
      await updateDoc(orderDocRef, {
        changesCount: nextChangesCount,
        changesDescription: changesText.trim(),
        progressStatus: 'cambios_solicitados' as const,
        price: nextPrice,
        updatedAt: serverTimestamp()
      });

      // Add audit message to chat
      await addDoc(collection(db, 'orders', selectedOrder.id, 'messages'), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'Cliente',
        text: `[SOLICITUD DE CAMBIOS +2€]\nDetalles: ${changesText.trim()}`,
        createdAt: serverTimestamp()
      });

      setChangesText('');
      setShowChangesModal(false);
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, orderPath);
      setChangesError('Error al solicitar cambios. Asegúrate de que el pedido no esté formalmente cerrado.');
    } finally {
      setIsRequestingChanges(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Trigger system warning about payment via Revolut chat message to help the admin
  const handleNotifyPayment = async () => {
    if (!selectedOrder) return;
    const confirmed = window.confirm('¿Quieres enviar una notificación de pago ficticio/real al administrador en el chat?');
    if (!confirmed) return;

    try {
      await addDoc(collection(db, 'orders', selectedOrder.id, 'messages'), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'Cliente',
        text: `🕒 Hola Admin, acabo de realizar el pago correspondiente de mi pedido (${selectedOrder.price}€). Quedo a la espera de que verifiques y actives el desarrollo. ¡Gracias!`,
        createdAt: serverTimestamp()
      });
      alert('Se ha enviado una notificación directa al chat del administrador.');
    } catch (err: any) {
      console.error(err);
      alert('Error al enviar la notificación automática al chat.');
    }
  };

  const getStatusBadge = (status: ProgressStatus) => {
    switch (status) {
      case 'en_espera':
        return <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-medium">🕒 En Espera</span>;
      case 'en_curso':
        return <span className="bg-sky-100 text-sky-800 text-xs px-2.5 py-1 rounded-full font-medium">💻 En curso</span>;
      case 'hecho':
        return <span className="bg-teal-100 text-teal-800 text-xs px-2.5 py-1 rounded-full font-medium">🎉 Hecho / Listo</span>;
      case 'finalizado':
        return <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-full font-medium">🔒 Finalizado</span>;
      case 'cambios_solicitados':
        return <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-1 rounded-full font-medium">🔄 Cambiando</span>;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8" id="client-panel-dashboard">
      {/* Navigation Left rail / Tabs */}
      <div className="md:col-span-3 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm animate-fade-in">
          <span className="text-[11px] font-mono text-indigo-650 font-bold block mb-3">ZONA DE CLIENTES</span>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setActiveTab('mis_pedidos');
                setFormSuccess(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-sans font-semibold rounded-xl text-left transition-all cursor-pointer ${
                activeTab === 'mis_pedidos'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-100'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              id="tab-mis-pedidos"
            >
              <Layers className="w-4 h-4" />
              Ver mis pedidos ({orders.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('nuevo_pedido');
                setFormSuccess(false);
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-sans font-semibold rounded-xl text-left transition-all cursor-pointer ${
                activeTab === 'nuevo_pedido'
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-105'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              id="tab-nuevo-pedido"
            >
              <CirclePlus className="w-4 h-4" />
              Solicitar nueva web (5€)
            </button>
          </div>
        </div>

        {/* Short notice as Bento card */}
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5">
          <h4 className="font-sans font-bold text-indigo-900 text-xs mb-1.5 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-600" />
            ¿Cómo funciona?
          </h4>
          <div className="font-sans text-[11px] text-indigo-950/80 space-y-2 leading-relaxed">
            <p><span className="font-bold text-indigo-700">1.</span> Describes la web que necesitas y creas tu pedido por 5€.</p>
            <p><span className="font-bold text-indigo-700">2.</span> Realizas el pago seguro y chateas directamente con nosotros.</p>
            <p><span className="font-bold text-indigo-700">3.</span> Recibes tu enlace y código fuente listo para usar.</p>
            <p><span className="font-bold text-indigo-700">4.</span> Si deseas añadir cambios posteriores, solicita refinaciones por tan solo 2€ por vez.</p>
          </div>
        </div>
      </div>

      {/* Primary Area */}
      <div className="md:col-span-9">
        {activeTab === 'nuevo_pedido' ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm" id="new-order-form-container">
            <h2 className="font-sans text-lg font-medium text-slate-900 mb-1">Solicitar Nueva Página Web</h2>
            <p className="font-sans text-xs text-slate-500 mb-6">
              Diseño integral responsive hecho a mano de principio a fin por solo 5€.
            </p>

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 font-sans">Mi Nombre completo</label>
                  <input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    type="text"
                    required
                    placeholder="Ej. Juan Pérez"
                    className="w-full text-xs font-sans border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white transition-all"
                    id="client-form-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1 font-sans">Número de contacto (SMS/Whatsapp)</label>
                  <input
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    type="tel"
                    required
                    placeholder="Ej. +34 600 000 000"
                    className="w-full text-xs font-sans border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white transition-all"
                    id="client-form-phone"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 font-sans">
                  Email de notificación
                </label>
                <input
                  value={currentUser.email || ''}
                  disabled
                  type="text"
                  className="w-full text-xs font-mono bg-slate-50 text-slate-500 border border-slate-100 rounded-lg px-3 py-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 font-sans">
                  ¿Cómo quieres tu página web? (Descripción detallada)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={6}
                  required
                  placeholder="Describe la temática, secciones de la página, colores preferidos, si es para una tienda o marca personal, etc."
                  className="w-full text-xs font-sans border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white transition-all"
                  id="client-form-description"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="font-sans font-bold text-sm text-slate-800 block">Total del encargo: 5,00 €</span>
                  <span className="font-sans text-[10px] text-slate-500">Pago único inicial. Cambios incrementales por 2,00 €.</span>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="font-sans bg-indigo-600 text-white hover:bg-indigo-700 transition-all font-semibold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  id="submit-order-btn"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Confirmar y Solicitar
                </button>
              </div>

              {formError && (
                <p className="font-sans text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-3 italic">
                  {formError}
                </p>
              )}
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            {loading ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center" id="loading-client-orders">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
                <p className="font-sans text-xs text-slate-500">Cargando tus solicitudes en tiempo real...</p>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-12 text-center shadow-xs" id="no-client-orders">
                <Layers className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h3 className="font-sans font-semibold text-slate-700 text-sm mb-1">No tienes pedidos activos</h3>
                <p className="font-sans text-xs text-slate-500 mb-4">
                  Haz tu primera solicitud para construir una página web responsive por solo 5€ de manera profesional.
                </p>
                <button
                  onClick={() => setActiveTab('nuevo_pedido')}
                  className="font-sans bg-indigo-600 text-white hover:bg-indigo-700 text-xs px-4.5 py-2.5 rounded-xl cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-sm shadow-indigo-100 font-semibold"
                >
                  <CirclePlus className="w-3.5 h-3.5" /> Solicitar Web (5€)
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left side list */}
                <div className="lg:col-span-5 space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block px-1">Todos mis pedidos</span>
                  {orders.map((order) => {
                    const isSelected = order.id === selectedOrderId;
                    return (
                      <div
                        key={order.id}
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`border rounded-2xl p-4 cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                        id={`order-card-${order.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`font-mono text-[9px] ${isSelected ? 'text-slate-300' : 'text-slate-400'}`}>
                            #{order.id.slice(0, 8)}...
                          </span>
                          <span className="font-sans font-bold text-xs">{order.price} €</span>
                        </div>
                        <h4 className="font-sans text-xs font-semibold truncate mb-1">
                          {order.description.slice(0, 40)}...
                        </h4>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-sans max-w-fit ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {order.progressStatus}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-sans max-w-fit ${
                            order.paymentStatus === 'pagado'
                              ? 'bg-emerald-500/20 text-emerald-600 font-semibold'
                              : 'bg-amber-500/20 text-amber-600'
                          }`}>
                            {order.paymentStatus}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right side Detail */}
                <div className="lg:col-span-7">
                  {selectedOrder ? (
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5" id="client-selected-order-detail">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                        <div>
                          <span className="font-mono text-[10px] text-slate-400 block">ID DEL ENCARGO</span>
                          <span className="font-mono text-xs font-semibold text-slate-700">{selectedOrder.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(selectedOrder.progressStatus)}
                        </div>
                      </div>

                      {/* Web specs */}
                      <div>
                        <span className="font-sans font-semibold text-xs text-slate-800 block mb-1">Petición Original:</span>
                        <p className="font-sans text-xs text-slate-600 bg-slate-50 rounded-lg p-3.5 border border-slate-150 whitespace-pre-line leading-relaxed">
                          {selectedOrder.description}
                        </p>
                      </div>

                      {/* Revolut alert if unpaid */}
                      {selectedOrder.paymentStatus === 'pendiente' ? (
                        <div className="bg-amber-50 border border-amber-205 rounded-2xl p-4.5" id="revolut-payment-block">
                          <div className="flex items-center gap-2 mb-2">
                            <CreditCard className="w-5 h-5 text-amber-600" />
                            <h4 className="font-sans font-bold text-amber-800 text-xs">Pago Pendiente con Revolut</h4>
                          </div>
                          <p className="font-sans text-xs text-amber-700 leading-relaxed mb-3">
                            Este pedido tiene un costo de <strong>{selectedOrder.price}€</strong>. Por favor, realiza el pago enviando {selectedOrder.price}€ a través de Revolut a:
                            <br />
                            <a href="https://revolut.me/pageify_studio" target="_blank" rel="noreferrer" className="underline font-bold text-amber-900 select-all hover:text-black">
                              revolut.me/pageify_studio
                            </a>
                          </p>
                          <button
                            onClick={handleNotifyPayment}
                            className="bg-amber-600 hover:bg-amber-700 font-sans text-white font-semibold text-xs px-4.5 py-2.5 rounded-xl cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-sm shadow-amber-100 animate-pulse"
                            id="notify-revolut-payment"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Notificar Pago Realizado
                          </button>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-150 rounded-lg p-4 flex items-center gap-2.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <div>
                            <h4 className="font-sans font-semibold text-emerald-800 text-xs">Pago Confirmado</h4>
                            <p className="font-sans text-[11px] text-emerald-700">El pago correspondiente de {selectedOrder.price}€ ya se encuentra validado.</p>
                          </div>
                        </div>
                      )}

                      {/* Deliverables display if made or finalized */}
                      {(selectedOrder.resultUrl || selectedOrder.resultCode) && (
                        <div className="bg-slate-900 text-white rounded-2xl p-5.5 space-y-4 shadow-md shadow-slate-900/10 border border-slate-800" id="client-deliverables-panel">
                          <h3 className="font-sans font-semibold text-sm text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ¡Tu página web ha sido completada!
                          </h3>
                          <p className="font-sans text-xs text-slate-300 leading-relaxed">
                            Aquí tienes el enlace de previsualización y el código fuente HTML/CSS/JS listo para subir a tu hosting o dominio:
                          </p>

                          {selectedOrder.resultUrl && (
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase text-slate-400 font-semibold block font-sans">Enlace de Desarrollo:</span>
                              <a
                                href={selectedOrder.resultUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-mono text-xs text-sky-400 hover:underline hover:text-sky-300"
                                id="client-result-url-link"
                              >
                                {selectedOrder.resultUrl} <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}

                          {selectedOrder.resultCode && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] uppercase text-slate-400 font-semibold block font-sans">Código Fuente Adjunto:</span>
                                <button
                                  onClick={() => handleCopyCode(selectedOrder.resultCode || '')}
                                  className="flex items-center gap-1 text-[10px] font-sans bg-white/10 hover:bg-white/20 transition-all px-2 py-1 rounded cursor-pointer"
                                  id="client-copy-code-btn"
                                >
                                  <Copy className="w-3 h-3" />
                                  {copied ? '¡Copiado!' : 'Copiar Código'}
                                </button>
                              </div>
                              <pre className="text-left bg-black text-rose-300 text-[11px] font-mono p-3 rounded-lg overflow-x-auto max-h-[160px] border border-white/10">
                                <code>{selectedOrder.resultCode}</code>
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Request changes trigger */}
                      {selectedOrder.progressStatus !== 'finalizado' && (
                        <div className="border-t border-slate-100 pt-4 flex justify-between items-center bg-purple-50/45 p-4 rounded-2xl border border-purple-100">
                          <div>
                            <span className="font-sans font-bold text-xs text-purple-950 block">¿Quieres añadir cosas nuevas?</span>
                            <span className="font-sans text-[11px] text-purple-700/80">Solicita refinamientos por +2€ c/u.</span>
                          </div>
                          <button
                            onClick={() => setShowChangesModal(true)}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-sans text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-sm shadow-purple-100"
                            id="trigger-changes-btn"
                          >
                            <RefreshCw className="w-3.5 h-3.5" /> Solicitar Cambios (+2€)
                          </button>
                        </div>
                      )}

                      {/* Active Realtime Chat messages support */}
                      <div className="border-t border-slate-100 pt-4">
                        <span className="font-sans font-semibold text-xs text-slate-800 block mb-2">Canal de Comunicación Directa</span>
                        <ActiveChat
                          orderId={selectedOrder.id}
                          currentUser={currentUser}
                          orderStatus={selectedOrder.progressStatus}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Changes Modal Dialog */}
      {showChangesModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in" id="changes-request-modal">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="font-sans font-semibold text-slate-900 text-base">Solicitar Refinamientos (+2,00 €)</h3>
            <p className="font-sans text-xs text-slate-500 leading-relaxed">
              De acuerdo con nuestra política de diseño modular, cada solicitud de cambios o adición de nuevos elementos añade €2 adicionales al costo total de la web.
            </p>

            <form onSubmit={handleRequestChanges} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1 font-sans">
                  Describe detalladamente qué cambios quieres realizar:
                </label>
                <textarea
                  value={changesText}
                  onChange={(e) => setChangesText(e.target.value)}
                  required
                  rows={4}
                  placeholder="Ej. Quiero cambiar el color de fondo a negro y añadir un banner de contacto al final..."
                  className="w-full text-xs font-sans border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-800"
                  id="modal-changes-description"
                />
              </div>

              <div className="bg-purple-50 rounded-lg p-3.5 border border-purple-100 text-purple-900">
                <span className="font-sans font-bold text-xs block">Importe extra aproximado: +2,00 €</span>
                <span className="font-sans text-[11px] block mt-0.5">Precio total estimado de este encargo pasará a {selectedOrder.price + 2}€.</span>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowChangesModal(false)}
                  className="font-sans text-xs font-semibold text-slate-600 hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isRequestingChanges}
                  className="bg-purple-600 hover:bg-purple-700 font-sans text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1.5 transition-all disabled:opacity-50"
                  id="confirm-changes-btn"
                >
                  {isRequestingChanges ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Confirmar Solicitud (+2€)
                </button>
              </div>

              {changesError && (
                <p className="font-sans text-xs text-red-600 italic mt-2">
                  {changesError}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
