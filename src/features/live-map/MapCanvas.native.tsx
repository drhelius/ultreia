import { useEffect, useRef } from 'react';
import { WebView } from 'react-native-webview';
import { mapDocument, type MapCanvasProps } from './mapDocument';

export function MapCanvas(props: MapCanvasProps) {
  const webview = useRef<WebView>(null);
  const update = () => webview.current?.injectJavaScript(`window.updateCamino(${JSON.stringify({ ...props, onSelectService: undefined, kind: 'camino-map' })});true;`);
  useEffect(update, [props]);
  return <WebView ref={webview} source={{ html: mapDocument }} originWhitelist={['*']} onLoadEnd={update} javaScriptEnabled scrollEnabled={false} onMessage={(event) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.kind === 'map-ready') update();
      if (message.kind === 'select-service') props.onSelectService(message.id);
    } catch {}
  }} style={{ flex: 1, backgroundColor: '#132923' }} />;
}