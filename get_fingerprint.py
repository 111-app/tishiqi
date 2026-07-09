import zipfile
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import pkcs7

z = zipfile.ZipFile('tishiqi.apk')
for name in z.namelist():
    if name.endswith('.RSA') or name.endswith('.DSA'):
        data = z.read(name)
        try:
            certs = pkcs7.load_der_pkcs7_certificates(data)
            for cert in certs:
                fp = cert.fingerprint(hashes.SHA256())
                print(':'.join(f'{b:02X}' for b in fp))
        except Exception as e:
            print('Error loading PKCS7:', e)
