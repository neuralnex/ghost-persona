import * as crypto from 'crypto';

export class GhostCryptoEngine {
  private static readonly ALGORITHM = 'aes-256-gcm';

  public static generateMasterKey(): Uint8Array {
    return new Uint8Array(crypto.randomBytes(32));
  }

  public static encryptContext(payload: string, masterKey: Uint8Array): { ciphertext: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.ALGORITHM, Buffer.from(masterKey), iv);
    
    let encrypted = cipher.update(payload, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');

    return {
      ciphertext: encrypted,
      iv: iv.toString('hex'),
      tag: tag
    };
  }

  public static decryptContext(ciphertext: string, ivHex: string, tagHex: string, masterKey: Uint8Array): string {
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(this.ALGORITHM, Buffer.from(masterKey), iv);
    
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
