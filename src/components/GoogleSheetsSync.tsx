import { useState, useEffect } from 'react';
import { getAccessToken } from '../firebase';
import { Order } from '../types';
import { FileSpreadsheet, RefreshCw, Check, AlertTriangle, ExternalLink } from 'lucide-react';

interface GoogleSheetsSyncProps {
  orders: Order[];
}

export default function GoogleSheetsSync({ orders }: GoogleSheetsSyncProps) {
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    return localStorage.getItem('pageify_spreadsheet_id');
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-sync if orders change and we already have a spreadsheetId
  useEffect(() => {
    if (spreadsheetId && orders.length > 0) {
      // We can let them sync manually to feel the craft and control
    }
  }, [orders, spreadsheetId]);

  const handleCreateNewSpreadsheet = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    setErrorMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se encontró el token de acceso de Google. Por favor, vuelve a iniciar sesión.');
      }

      // 1. Create a spreadsheet using the Google Sheets API
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: `Pageify Studio - Registro de Pedidos y Ventas`,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Error al crear la hoja de cálculo');
      }

      const sheetData = await response.json();
      const newSheetId = sheetData.spreadsheetId;

      if (!newSheetId) {
        throw new Error('No se recibió el ID de la hoja de cálculo creada.');
      }

      localStorage.setItem('pageify_spreadsheet_id', newSheetId);
      setSpreadsheetId(newSheetId);
      
      // 2. Immediately populate with headers and first data rows
      await syncData(newSheetId, token);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setErrorMessage(err.message || 'Error al conectar con Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualSync = async () => {
    if (!spreadsheetId) return;
    setIsSyncing(true);
    setSyncStatus('idle');
    setErrorMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('No se encontró el token de acceso de Google. Re-autentícate iniciando sesión de nuevo.');
      }

      await syncData(spreadsheetId, token);
    } catch (err: any) {
      console.error(err);
      setSyncStatus('error');
      setErrorMessage(err.message || 'Error durante la sincronización');
    } finally {
      setIsSyncing(false);
    }
  };

  const syncData = async (sheetId: string, token: string) => {
    // Standard rows: Order data
    const headers = [
      'ID Pedido',
      'Cliente (Nombre)',
      'Cliente Email',
      'Cliente Teléfono',
      'Descripción del Pedido',
      'Precio Cobrado (€)',
      'Estado Progreso',
      'Estado Pago',
      'Iteración Cambios',
      'Último Feedback Cliente',
      'URL Resultado',
      'Código Entregado',
      'Fecha Creación',
      'Última Actualización'
    ];

    const rows = orders.map(order => [
      order.id,
      order.clientName,
      order.clientEmail,
      order.clientPhone,
      order.description,
      order.price,
      order.progressStatus,
      order.paymentStatus,
      order.changesCount,
      order.changesDescription || 'Ninguno',
      order.resultUrl || 'No disponible',
      order.resultCode || 'No disponible',
      new Date(order.createdAt).toLocaleString('es-ES'),
      new Date(order.updatedAt).toLocaleString('es-ES')
    ]);

    const values = [headers, ...rows];

    // Bulk update the Sheet ranges (writing into Sheet1)
    const updateResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/Sheet1!A1:N${values.length + 5}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      throw new Error(errorData.error?.message || 'Error al escribir los datos en Sheet1');
    }

    setSyncStatus('success');
  };

  const handleUnlink = () => {
    if (window.confirm('¿Seguro que deseas desvincular la hoja de cálculo actual? No se eliminará de tu Drive.')) {
      localStorage.removeItem('pageify_spreadsheet_id');
      setSpreadsheetId(null);
      setSyncStatus('idle');
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6" id="google-sheets-sync-widget">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-emerald-600 animate-pulse" />
          <div>
            <h3 className="font-sans font-semibold text-slate-800 text-sm">Sincronización con Google Sheets</h3>
            <p className="font-sans text-xs text-slate-500">
              Registra automáticamente clientes y ventas en una hoja de cálculo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {spreadsheetId && (
            <button
              onClick={handleUnlink}
              className="font-sans text-xs text-red-650 hover:text-red-800 font-medium transition-colors px-2.5 py-1 rounded-lg"
              id="unlink-sheet-btn"
            >
              Desvincular
            </button>
          )}
        </div>
      </div>

      {spreadsheetId ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-100 rounded-xl">
            <div className="min-w-0 flex-1">
              <span className="font-sans text-[10px] uppercase tracking-wider font-semibold text-slate-400 block mb-0.5">
                Hoja de Cálculo Vinculada
              </span>
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-emerald-600 hover:text-emerald-700 font-semibold truncate flex items-center gap-1.5"
                id="view-sheet-link"
              >
                Abrir en Google Sheets <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleManualSync}
                disabled={isSyncing}
                className="flex items-center gap-1.5 font-sans bg-emerald-600 text-white font-semibold text-xs px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 cursor-pointer shadow-sm shadow-emerald-100"
                id="sync-now-btn"
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sincronizar Ya
              </button>
            </div>
          </div>

          {syncStatus === 'success' && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2.5" id="sync-success-alert">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>¡Sincronización completada con éxito! Todos los pedidos se encuentran registrados en línea.</span>
            </div>
          )}

          {syncStatus === 'error' && (
            <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl p-2.5" id="sync-error-info">
              <AlertTriangle className="w-4 h-4 text-red-650 flex-shrink-0" />
              <span>{errorMessage || 'Error imprevisto al enviar datos.'}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white/60 border border-dashed border-slate-200 rounded-xl p-6 text-center">
          <p className="font-sans text-xs text-slate-500 mb-4 font-medium">
            No tienes ninguna hoja de cálculo vinculada para este panel administrativo todavía.
          </p>
          <button
            onClick={handleCreateNewSpreadsheet}
            disabled={isSyncing}
            className="inline-flex items-center gap-2 font-sans bg-emerald-600 text-white font-bold text-xs px-4.5 py-3 rounded-xl hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-100 cursor-pointer disabled:opacity-50"
            id="create-sheet-btn"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            Crear y Vincular Hoja en Google Drive
          </button>
        </div>
      )}
    </div>
  );
}
