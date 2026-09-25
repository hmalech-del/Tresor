// Eine eigene drand-Kette mit bekanntem Geheimschluessel - fuer Tests, weil
// das echte Netz aus der Sandbox nicht erreichbar ist. Mathematisch dieselbe
// Kette wie quicknet (bls-unchained-g1-rfc9380), nur mit anderem Schluessel.
const { bls12_381: bls } = require('@noble/curves/bls12-381');
const { sha256 } = require('@noble/hashes/sha256');
const nodeCrypto = require('crypto');
const DST = 'BLS_SIG_BLS12381G1_XMD:SHA-256_SSWU_RO_NUL_';
function neu({ genesisSek, period = 3 } = {}) {
  const geheim = BigInt('0x' + nodeCrypto.randomBytes(32).toString('hex')) % bls.fields.Fr.ORDER;
  const info = {
    public_key: bls.G2.ProjectivePoint.BASE.multiply(geheim).toHex(true), period,
    genesis_time: genesisSek ?? Math.floor(Date.now() / 1000) - 3000,
    hash: nodeCrypto.randomBytes(32).toString('hex'), groupHash: 'bb'.repeat(32),
    schemeID: 'bls-unchained-g1-rfc9380', metadata: { beaconID: 'schein' }
  };
  function beacon(r, schluessel = geheim) {
    const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(r));
    const sig = bls.G1.hashToCurve(sha256(b), { DST }).multiply(schluessel).toHex(true);
    return { round: r, signature: sig, randomness: Buffer.from(sha256(Buffer.from(sig, 'hex'))).toString('hex') };
  }
  const faelscher = BigInt('0x' + nodeCrypto.randomBytes(32).toString('hex')) % bls.fields.Fr.ORDER;
  return { info, beacon, gefaelscht: r => beacon(r, faelscher),
           rundeZu: ms => Math.max(1, Math.ceil((ms / 1000 - info.genesis_time) / info.period) + 1) };
}
module.exports = { neu };
