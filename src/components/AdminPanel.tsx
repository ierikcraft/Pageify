import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError } from '../firebase';
import { collection, query, updateDoc, doc, serverTimestamp, onSnapshot, orderBy, addDoc } from 'firebase/firestore';
import { Order, ProgressStatus, PaymentStatus, OperationType } from '../types';
import { User } from 'firebase/auth';
import { Loader2, DollarSign, Layers, CheckCircle2, ShoppingBag, Eye, UserCheck, MessageSquare, Phone, Mail, Link, Code, Save, Trash2, Search, Filter } from 'lucide-react';
import ActiveChat from './ActiveChat';
import GoogleSheetsSync from './GoogleSheetsSync';

interface AdminPanelProps {
  currentUser: User;
}

export default function AdminPanel({ currentUser }: AdminPanelProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  // Selected Order Edit state
  const [editProgress, setEditProgress] = useState<ProgressStatus>('en_espera');
  const [editPayment, setEditPayment] = useState<PaymentStatus>('pendiente');
  const [resultUrl, setResultUrl] = useState('');
  const [resultCode, setResultCode] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load all system orders
  useEffect(() => {
    setLoading(true);
    const ordersCollectionPath = 'orders';
    const q = query(
      collection(db, 'orders'),
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
            resultUrl: data.resultUrl || '',
            resultCode: data.resultCode || '',
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
  }, []);

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  // Sync edit states when selectedOrder shifts
  useEffect(() => {
    if (selectedOrder) {
      setEditProgress(selectedOrder.progressStatus);
      setEditPayment(selectedOrder.paymentStatus);
      setResultUrl(selectedOrder.resultUrl || '');
      setResultCode(selectedOrder.resultCode || '');
      setUpdateMsg(null);
    }
  }, [selectedOrderId, selectedOrder]);

  // Handle order changes submission
  const handleUpdateOrder = async (e: React.FormEvent, closeChatValue = false) => {
    e.preventDefault();
    if (!selectedOrder) return;

    setIsUpdating(true);
    setUpdateMsg(null);

    const orderDocRef = doc(db, 'orders', selectedOrder.id);
    const orderPath = `orders/${selectedOrder.id}`;

    // If closeChatValue is toggled, set state directly to "finalizado" as requested:
    // "puedes terminar el pedido q significa q el chat se cerrara i el cliente recibira el codigo/enlace"
    const finalProgress = closeChatValue ? 'finalizado' : editProgress;

    try {
      await updateDoc(orderDocRef, {
        progressStatus: finalProgress,
        paymentStatus: editPayment,
        resultUrl: resultUrl.trim(),
        resultCode: resultCode.trim(),
        updatedAt: serverTimestamp()
      });

      // Send audit chat notification automatically
      let systemNote = `[SISTEMA] El equipo ha actualizado la información de tu pedido. `;
      if (closeChatValue) {
        systemNote = `[SISTEMA] ¡Tu pedido ha sido marcado como COMPLETADO Y CERRADO! El chat se encuentra clausurado. Ya puedes descargar y acceder a tu código o URL. ¡Gracias por confiar en Pageify!`;
      } else if (finalProgress === 'hecho') {
        systemNote = `[SISTEMA] ¡Tu página web ha sido completada! Ya puedes ver el enlace de demostración y el código fuente en tu panel de control. Si todo está correcto el admin finalizará la entrega.`;
      }

      await addDoc(collection(db, 'orders', selectedOrder.id, 'messages'), {
        senderId: 'system_admin',
        senderName: 'Pageify Equipo',
        text: systemNote,
        createdAt: serverTimestamp()
      });

      setUpdateMsg({ type: 'success', text: 'Pedido modificado y actualizado correctamente.' });
    } catch (err: any) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, orderPath);
      setUpdateMsg({ type: 'error', text: 'Error al actualizar el pedido. Comprueba permisos o campos obligatorios.' });
    } finally {
      setIsUpdating(false);
    }
  };

  // Aggregated dashboards
  const totalRevenues = orders
    .filter(o => o.paymentStatus === 'pagado')
    .reduce((sum, current) => sum + current.price, 0);

  const pendingRevenues = orders
    .filter(o => o.paymentStatus === 'pendiente')
    .reduce((sum, current) => sum + current.price, 0);

  const activeOrdersCount = orders.filter(o => o.progressStatus !== 'finalizado').length;
  const completedOrdersCount = orders.filter(o => o.progressStatus === 'finalizado').length;

  // Filtered orders list
  const filteredOrders = orders.filter(o => {
    const matchesSearch =
      o.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.clientPhone.includes(searchTerm);

    const matchesStatus = statusFilter === 'all' || o.progressStatus === statusFilter;
    const matchesPayment = paymentFilter === 'all' || o.paymentStatus === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  return (
    <div className="space-y-6" id="admin-panel">
      {/* 1. Dashboard summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Ganancias Pagadas</span>
            <span className="text-xl font-bold font-sans text-slate-800 block">{totalRevenues.toFixed(2)} €</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Ventas Pendientes</span>
            <span className="text-xl font-bold font-sans text-slate-800 block">{pendingRevenues.toFixed(2)} €</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-indigo-600 text-white rounded-2xl p-5 shadow-sm shadow-indigo-100 flex items-center gap-4">
          <div className="p-3 bg-white/20 text-white rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-indigo-100 font-sans block">Pedidos Activos</span>
            <span className="text-xl font-bold font-sans block">{activeOrdersCount}</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans block">Entregas Finalizadas</span>
            <span className="text-xl font-bold font-sans text-slate-800 block">{completedOrdersCount}</span>
          </div>
        </div>
      </div>

      {/* Google Sheets Sync Controller */}
      <GoogleSheetsSync orders={orders} />

      {/* Search and filtered lists */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Orders Table/Container column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-sans font-semibold text-slate-900 text-sm">Listado General de Pedidos</h3>
            
            {/* Search Input */}
            <div className="relative">
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                type="text"
                placeholder="Buscar por cliente, email o teléfono..."
                className="w-full text-xs font-sans border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                id="search-orders"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
            </div>

            {/* Quick Filters */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-sans text-slate-400 font-medium mb-1">PROGRESO</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full text-[11px] font-sans border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="filter-status"
                >
                  <option value="all">Ver Todos</option>
                  <option value="en_espera">En Espera</option>
                  <option value="en_curso">En Curso</option>
                  <option value="hecho">Hecho</option>
                  <option value="finalizado">Finalizado</option>
                  <option value="cambios_solicitados">Cambios Solicitados</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-sans text-slate-400 font-medium mb-1">PAGO</label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full text-[11px] font-sans border border-slate-200 rounded-xl px-2 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="filter-payment"
                >
                  <option value="all">Ver Todos</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                </select>
              </div>
            </div>
          </div>

          {/* Render List */}
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {loading ? (
              <div className="text-center p-8 bg-white border border-slate-200 rounded-2xl shadow-xs">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto mb-2" />
                <span className="font-sans text-xs text-slate-450">Leyendo Firestore db en real-time...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center p-8 bg-white border border-dashed border-slate-200 rounded-2xl shadow-xs">
                <span className="font-sans text-xs text-slate-400 block">No se encontraron resultados para los filtros actuales.</span>
              </div>
            ) : (
              filteredOrders.map(order => {
                const isSelected = order.id === selectedOrderId;
                const dateText = new Date(order.createdAt).toLocaleDateString();
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`p-4 border rounded-2xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs'
                    }`}
                    id={`admin-order-item-${order.id}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-sans text-xs font-semibold block">{order.clientName}</span>
                      <span className="font-sans text-[11px] font-bold">{order.price} €</span>
                    </div>
                    
                    <span className={`text-[10px] font-mono block ${isSelected ? 'text-slate-350' : 'text-slate-400'}`}>
                      {order.clientEmail} • {order.clientPhone}
                    </span>

                    <p className={`font-sans text-xs mt-2 line-clamp-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                      {order.description}
                    </p>

                    <div className="flex gap-2 items-center mt-3">
                      <span className={`text-[9px] px-2 py-0.5 rounded-sm uppercase tracking-wide font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {order.progressStatus}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-sm uppercase tracking-wide font-bold ${
                        order.paymentStatus === 'pagado'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-500'
                      }`}>
                        {order.paymentStatus}
                      </span>
                      {order.changesCount > 0 && (
                        <span className="bg-purple-150 text-purple-700 text-[9px] px-1.5 py-0.5 rounded">
                          {order.changesCount} refinaciones
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Order Detail Panel */}
        <div className="lg:col-span-7">
          {selectedOrder ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6" id="admin-order-detail-card">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <span className="font-sans text-[10px] text-slate-400 uppercase font-bold tracking-wider">Detalle del Carpeta</span>
                  <h2 className="font-sans font-bold text-slate-800 text-sm">Página Web de {selectedOrder.clientName}</h2>
                  <span className="font-mono text-xs text-slate-400 block mt-1">#ID: {selectedOrder.id}</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-sans text-slate-800 block">{selectedOrder.price} €</span>
                  <span className="text-[10px] font-mono text-slate-400 block">Cambios realizados: {selectedOrder.changesCount}</span>
                </div>
              </div>

              {/* Client Info direct contact card */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3" id="admin-client-info-section">
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block">EMAIL CLIENTE</span>
                    <a href={`mailto:${selectedOrder.clientEmail}`} className="text-xs text-slate-700 font-medium select-all hover:underline">
                      {selectedOrder.clientEmail}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block">TELÉFONO</span>
                    <a href={`tel:${selectedOrder.clientPhone}`} className="text-xs text-slate-700 font-medium select-all hover:underline">
                      {selectedOrder.clientPhone}
                    </a>
                  </div>
                </div>
              </div>

              {/* Requirement prompt */}
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Descripción del Encargo</span>
                <p className="font-sans text-xs text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-150 whitespace-pre-line leading-relaxed">
                  {selectedOrder.description}
                </p>
                {selectedOrder.changesDescription && (
                  <div className="mt-2.5 p-3 rounded-lg bg-purple-50/80 border border-purple-100">
                    <span className="text-[10px] font-bold text-purple-700 uppercase block mb-1">Última Refinación Solicitada:</span>
                    <p className="text-purple-900 font-sans text-xs whitespace-pre-line leading-relaxed">
                      {selectedOrder.changesDescription}
                    </p>
                  </div>
                )}
              </div>

              {/* Interactive state modifiers */}
              <form onSubmit={(e) => handleUpdateOrder(e)} className="space-y-4">
                <h3 className="font-sans font-semibold text-slate-800 text-xs border-b border-dashed border-slate-100 pb-1 flex items-center gap-1.5">
                  <Save className="w-4 h-4" /> Gestor de Estados de Pedido
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-sans font-medium text-slate-655 mb-1">Estado de Entrega</label>
                    <select
                      value={editProgress}
                      onChange={(e) => setEditProgress(e.target.value as ProgressStatus)}
                      className="w-full text-xs font-sans border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="edit-progress-status"
                    >
                      <option value="en_espera">🕒 En Espera de Inicio</option>
                      <option value="en_curso">💻 Desarrollando / en curso</option>
                      <option value="hecho">🎉 Hecho / Para revisión</option>
                      <option value="finalizado">🔒 Finalizado y Cerrado</option>
                      <option value="cambios_solicitados">🔄 Cambios Solicitados</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans font-medium text-slate-655 mb-1">Estado del Pago (Revolut)</label>
                    <select
                      value={editPayment}
                      onChange={(e) => setEditPayment(e.target.value as PaymentStatus)}
                      className="w-full text-xs font-sans border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      id="edit-payment-status"
                    >
                      <option value="pendiente">💳 Pendiente de Pago</option>
                      <option value="pagado">✅ Pagado y Verificado</option>
                    </select>
                  </div>
                </div>

                {/* Delivered assets url & code content outputs */}
                <h3 className="font-sans font-semibold text-slate-800 text-xs border-b border-dashed border-slate-100 pt-3 pb-1 flex items-center gap-1.5">
                  <Code className="w-4 h-4" /> Entregar Entregables y Recursos
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-sans font-medium text-slate-655 mb-1">Enlace de Previsualización Web (URL)</label>
                    <input
                      value={resultUrl}
                      onChange={(e) => setResultUrl(e.target.value)}
                      type="url"
                      placeholder="https://ejemplo-web-creada.com"
                      className="w-full text-xs font-sans border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white transition-all"
                      id="input-result-url"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-sans font-medium text-slate-655 mb-1">Código Fuente de Entrega (HTML/CSS/JS)</label>
                    <textarea
                      value={resultCode}
                      onChange={(e) => setResultCode(e.target.value)}
                      rows={4}
                      placeholder="Coloca aquí el código final de la página web para que el cliente lo copie..."
                      className="w-full text-xs font-mono border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white transition-all"
                      id="input-result-code"
                    />
                  </div>
                </div>

                {/* Submitting Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="w-full sm:w-auto font-sans bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 text-xs px-4.5 py-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    id="save-update-btn"
                  >
                    {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Guardar Parámetros
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleUpdateOrder(e, true)}
                    disabled={isUpdating || selectedOrder.progressStatus === 'finalizado'}
                    className="w-full sm:w-auto font-sans bg-indigo-600 text-white hover:bg-indigo-700 text-xs px-5 py-2.5 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 ml-auto font-extrabold shadow-sm shadow-indigo-100"
                    id="finalize-complete-btn"
                  >
                    {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Enviar Resultado y Terminar Pedido
                  </button>
                </div>

                {updateMsg && (
                  <p className={`font-sans text-xs rounded-lg p-2.5 ${
                    updateMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-red-50 text-red-800 border border-red-100'
                  }`}>
                    {updateMsg.text}
                  </p>
                )}
              </form>

              {/* Integrated active chat logs in real-time */}
              <div className="border-t border-slate-100 pt-4">
                <span className="font-sans font-semibold text-xs text-slate-800 block mb-2">Historial de Comunicación Realtime</span>
                <ActiveChat
                  orderId={selectedOrder.id}
                  currentUser={currentUser}
                  orderStatus={selectedOrder.progressStatus}
                />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-sans text-xs text-slate-500">Selecciona un pedido a la izquierda para administrar estados y chatear.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
