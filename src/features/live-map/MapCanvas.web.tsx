import { useEffect, useRef } from 'react';
import { mapDocument, type MapCanvasProps } from './mapDocument';

export function MapCanvas(props: MapCanvasProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef(props);
  current.current = props;
  const update = () => frame.current?.contentWindow?.postMessage({ ...current.current, onSelectService: undefined, kind: 'camino-map' }, '*');
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.kind === 'map-ready') update();
      if (event.data?.kind === 'select-service') current.current.onSelectService(event.data.id);
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  useEffect(update, [props]);
  return <iframe ref={frame} title="Mapa del Camino" srcDoc={mapDocument} onLoad={update} style={{ width: '100%', height: '100%', border: 0, display: 'block' }} />;
}