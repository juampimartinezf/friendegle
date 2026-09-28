// Levanta un servidor TURN local en :3478 con la configuración de coturn/turnserver.conf.
//  - Si Docker está disponible: Coturn oficial (coturn/coturn), igual que en producción.
//  - Si no (p. ej. Windows sin Docker): node-turn, un TURN en JS solo para desarrollo,
//    con el mismo usuario, realm y rango de puertos leídos del mismo .conf.
import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const confPath = fileURLToPath(new URL('../coturn/turnserver.conf', import.meta.url));
const forceNode = process.argv.includes('--node');
const hasDocker = !forceNode && spawnSync('docker info', { stdio: 'ignore', shell: true }).status === 0;

if (hasDocker) {
  console.log('[turn] Coturn en Docker → turn:localhost:3478');
  const args = [
    'run', '--rm', '--name', 'friendegle-turn',
    '-p', '3478:3478', '-p', '3478:3478/udp', '-p', '49160-49200:49160-49200/udp',
    '-v', `${confPath}:/etc/coturn/turnserver.conf:ro`,
    'coturn/coturn', '-c', '/etc/coturn/turnserver.conf',
  ];
  spawn('docker', args, { stdio: 'inherit' }).on('exit', (code) => process.exit(code ?? 0));
} else {
  const conf = Object.fromEntries(
    readFileSync(confPath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
      .map((l) => l.split(/=(.*)/).slice(0, 2).map((s) => s.trim())),
  );
  const [user, pass] = conf.user.split(':');
  const require = createRequire(import.meta.url);
  const Turn = require('node-turn');

  // Parches para bugs de node-turn 0.0.6 (sin ellos la llamada se corta a los ~40 s):
  //  1) La respuesta a ChannelBind no lleva MESSAGE-INTEGRITY: Chrome la descarta, reintenta
  //     y al agotar los reintentos (~40 s) da la conexión por fallida. Y una vez aceptada,
  //     node-turn no sabe recibir ChannelData del cliente (solo enviarlo): se implementa aquí.
  //  2) Allocation.update() sin argumento programa el borrado con setTimeout(NaN) = inmediato.
  //  3) refresh.js lee server.defaultLifetime / server.maxAllocateTimeout, que no existen
  //     (el servidor los guarda con otro nombre) → lifetime NaN → la asignación se borra
  //     en cuanto Chrome la renueva.
  const ChannelBind = require('node-turn/lib/methods/channelBind');
  const originalChannelBind = ChannelBind.prototype.channelBind;
  ChannelBind.prototype.channelBind = function (msg, reply) {
    const resolve = reply.resolve.bind(reply);
    reply.resolve = () => {
      reply.addAttribute('message-integrity');
      return resolve();
    };
    return originalChannelBind.call(this, msg, reply);
  };

  const Network = require('node-turn/lib/network');
  const Transport = require('node-turn/lib/transport');
  const Address = require('node-turn/lib/address');
  const ChannelMsg = require('node-turn/lib/channelMessage');
  const UDP = require('node-turn/lib/constants').TRANSPORT.PROTOCOL.UDP;
  const originalStart = Network.prototype.start;
  Network.prototype.start = function () {
    originalStart.call(this);
    this.sockets.forEach((socket, i) => {
      const dst = new Address(this.listeningIps[i], this.listeningPort);
      socket.prependListener('message', (data, rinfo) => {
        if (data.length < 4 || (data[0] & 0xc0) !== 0x40) return; // no es ChannelData
        const transport = new Transport(UDP, new Address(rinfo.address, rinfo.port), dst, socket);
        const allocation = this.server.allocations[transport.get5Tuple()];
        const channel = new ChannelMsg();
        if (!allocation || !channel.read(data)) return;
        const peer = allocation.channelBindings[channel.channelNumber];
        if (peer) allocation.sockets[0].send(channel.data, peer.port, peer.address);
      });
    });
  };

  const Allocation = require('node-turn/lib/allocation');
  const originalUpdate = Allocation.prototype.update;
  Allocation.prototype.update = function (lifetime) {
    return originalUpdate.call(this, Number(lifetime) > 0 ? lifetime : this.lifetime);
  };

  const server = new Turn({
    listeningPort: Number(conf['listening-port']),
    listeningIps: ['127.0.0.1'],
    relayIps: ['127.0.0.1'],
    minPort: Number(conf['min-port']),
    maxPort: Number(conf['max-port']),
    realm: conf.realm,
    authMech: 'long-term',
    credentials: { [user]: pass },
    debugLevel: 'WARN',
  });
  server.defaultLifetime = 600;
  server.maxAllocateTimeout = 3600;
  server.start();
  console.log(`[turn] Docker no disponible → node-turn (solo desarrollo) en turn:localhost:${conf['listening-port']}`);
}
