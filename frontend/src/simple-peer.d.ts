// El bundle precompilado incluye los polyfills de Node (Buffer, process, stream) que simple-peer necesita en el navegador
declare module 'simple-peer/simplepeer.min.js' {
  import Peer from 'simple-peer';
  export default Peer;
}
