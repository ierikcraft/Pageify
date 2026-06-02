import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { Message, OperationType } from '../types';
import { Send, LogIn, Lock } from 'lucide-react';
import { User } from 'firebase/auth';

interface ActiveChatProps {
  orderId: string;
  currentUser: User;
  orderStatus: string;
}

export default function ActiveChat({ orderId, currentUser, orderStatus }: ActiveChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isChatClosed = orderStatus === 'finalizado';

  // Listen to real-time chat messages
  useEffect(() => {
    const messagesCollectionPath = `orders/${orderId}/messages`;
    const q = query(collection(db, 'orders', orderId, 'messages'), orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedMessages: Message[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Avoid mapping messages that do not have createdAt yet due to serverTimestamp delay
          const createdAtDate = data.createdAt ? (data.createdAt.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt)) : new Date();
          loadedMessages.push({
            id: docSnap.id,
            senderId: data.senderId,
            senderName: data.senderName || 'Anónimo',
            text: data.text || '',
            createdAt: createdAtDate.toISOString(),
          });
        });
        setMessages(loadedMessages);
        setErrorMsg(null);
      },
      (error) => {
        // Enforce reporting using standard handleFirestoreError from system skills
        handleFirestoreError(error, OperationType.GET, messagesCollectionPath);
        setErrorMsg('No se pudieron recuperar los mensajes del chat.');
      }
    );

    return () => unsubscribe();
  }, [orderId]);

  // Handle scroll to bottom whenever messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isChatClosed || isSending) return;

    setIsSending(true);
    setErrorMsg(null);
    const messagesCollectionPath = `orders/${orderId}/messages`;

    try {
      await addDoc(collection(db, 'orders', orderId, 'messages'), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || currentUser.email || 'Cliente',
        text: inputText.trim(),
        createdAt: serverTimestamp(),
      });
      setInputText('');
    } catch (error: any) {
      console.error(error);
      // Reporting error details back to workspace
      handleFirestoreError(error, OperationType.CREATE, messagesCollectionPath);
      setErrorMsg('No tienes permiso para enviar mensajes en este pedido o el chat se encuentra cerrado.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[400px] bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden mt-4" id={`chat-box-${orderId}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 px-4 py-3.5 text-white flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></div>
          <span className="font-sans font-semibold text-xs">Canal Directo de Comunicación</span>
        </div>
        <div>
          {isChatClosed ? (
            <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-500/20">
              <Lock className="w-3 h-3" /> Cerrado
            </span>
          ) : (
            <span className="text-[10px] uppercase font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/20">
              Activo
            </span>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <span className="font-sans text-xs text-slate-400 font-semibold">¿Tienes alguna duda o detalle que ajustar?</span>
            <span className="font-sans text-[11px] text-slate-450 mt-1">Escribe tu primer mensaje y el equipo te responderá de inmediato.</span>
          </div>
        ) : (
          messages.map((message) => {
            const isMe = message.senderId === currentUser.uid;
            return (
              <div
                key={message.id}
                className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
              >
                <span className="font-sans text-[10px] text-slate-400 font-medium mb-0.5 px-1">
                  {isMe ? 'Tú' : message.senderName}
                </span>
                <div
                  className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words ${
                    isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm shadow-indigo-100'
                      : 'bg-white border border-slate-200 text-slate-850 rounded-tl-none shadow-xs'
                  }`}
                >
                  {message.text}
                </div>
                <span className="font-mono text-[9px] text-slate-400 mt-0.5 px-1">
                  {new Date(message.createdAt).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSendMessage} className="p-2 border-t border-slate-150 bg-white flex gap-2">
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isChatClosed}
          type="text"
          placeholder={isChatClosed ? "El pedido ha finalizado, chat cerrado." : "Escribe un mensaje..."}
          className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50/50 focus:bg-white transition-all disabled:bg-slate-100 disabled:text-slate-400"
          id={`chat-input-${orderId}`}
        />
        <button
          type="submit"
          disabled={isChatClosed || !inputText.trim() || isSending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-indigo-600 cursor-pointer flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-100"
          id={`chat-send-btn-${orderId}`}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 text-[11px] px-3 py-1.5 font-sans border-t border-red-100 italic">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
