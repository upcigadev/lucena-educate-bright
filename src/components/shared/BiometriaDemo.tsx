import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Camera, Wifi, XCircle, CheckCircle } from 'lucide-react';

interface AccessLogEvent {
  id?: string;
  userId?: string;
  status: string;
  timestamp?: string;
  photoBase64?: string;
}

export function BiometriaDemo() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<AccessLogEvent[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  useEffect(() => {
    // Conectar ao websocket da ponte local
    const newSocket = io('http://localhost:3000', {
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      toast.success('Conectado à ponte biométrica local!');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      toast.error('Desconectado da ponte biométrica!');
    });

    newSocket.on('device:accessLog', (data: AccessLogEvent) => {
      // Receber o evento e adicionar ao feed de logs (no topo)
      setLogs((prevLogs) => [data, ...prevLogs].slice(0, 20)); // manter últimos 20
      toast('Novo registro de acesso visualizado!');
    });

    setSocket(newSocket);

    return () => {
      newSocket.off('connect');
      newSocket.off('disconnect');
      newSocket.off('device:accessLog');
      newSocket.close();
    };
  }, []);

  const handleConnectDevice = async () => {
    try {
      setLoadingAction('connect');
      const response = await fetch('http://localhost:3000/api/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Falha ao conectar no aparelho');
      toast.success('Comando de conexão enviado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao conectar no aparelho: verifique se a ponte está rodando.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStartCapture = async () => {
    try {
      setLoadingAction('capture');
      const response = await fetch('http://localhost:3000/api/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Falha ao iniciar captura facial');
      toast.success('Comando de captura facial enviado!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao iniciar captura: verifique se a ponte está rodando.');
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto border-2">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 pb-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${connected ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            <Wifi className={`h-5 w-5 ${connected ? 'text-emerald-600' : 'text-rose-600'}`} />
          </div>
          <div>
            <CardTitle className="text-xl">Demonstração iDFace</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Ponte Node.js {connected ? <Badge variant="outline" className="ml-2 text-emerald-600 border-emerald-200 bg-emerald-50">Online</Badge> : <Badge variant="outline" className="ml-2 text-rose-600 border-rose-200 bg-rose-50">Offline</Badge>}
            </p>
          </div>
        </div>
        <div className="flex bg-background border p-1 rounded-xl shadow-sm gap-2">
          <Button 
            variant="outline" 
            onClick={handleConnectDevice}
            disabled={loadingAction === 'connect'}
            className="flex items-center gap-2 border-primary/20 hover:bg-primary/5"
          >
            <Wifi className="h-4 w-4" />
            Conectar ao Aparelho
          </Button>
          <Button 
            onClick={handleStartCapture}
            disabled={loadingAction === 'capture'}
            className="flex items-center gap-2"
          >
            <Camera className="h-4 w-4" />
            Iniciar Captura Facial
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          <h3 className="font-medium text-sm flex items-center gap-2 text-muted-foreground">
            Feed em Tempo Real (Eventos Websocket)
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${connected ? 'bg-emerald-400' : 'bg-muted'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${connected ? 'bg-emerald-500' : 'bg-muted'}`}></span>
            </span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {logs.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-center border-2 border-dashed rounded-xl bg-muted/20 text-muted-foreground">
                <Camera className="h-10 w-10 mb-4 opacity-20" />
                <p>Nenhum evento registrado ainda.</p>
                <p className="text-xs mt-1">Aguardando logs de acesso (device:accessLog)...</p>
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="aspect-square w-full bg-muted flex items-center justify-center relative border-b overflow-hidden">
                    {log.photoBase64 ? (
                      <img 
                        src={`data:image/jpeg;base64,${log.photoBase64}`} 
                        alt="Captura Facial" 
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <div className="text-muted-foreground flex flex-col items-center gap-2">
                        <Camera className="h-8 w-8 opacity-50" />
                        <span className="text-xs">Sem Foto</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {log.status === 'success' || log.status === 'autorizado' || log.status === 'authorized' ? (
                        <Badge className="bg-emerald-500/90 text-white border-none gap-1 shadow-sm backdrop-blur-sm">
                          <CheckCircle className="h-3 w-3" /> Permitido
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-rose-500/90 gap-1 shadow-sm backdrop-blur-sm">
                          <XCircle className="h-3 w-3" /> Bloqueado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-1 bg-gradient-to-b from-card to-muted/20">
                    <p className="text-sm font-medium">Status: <span className="uppercase text-xs font-bold tracking-wider">{log.status}</span></p>
                    <p className="text-xs text-muted-foreground">User ID: {log.userId || 'Desconhecido'}</p>
                    {log.timestamp && <p className="text-[10px] text-muted-foreground font-mono mt-2">{new Date(log.timestamp).toLocaleString()}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
