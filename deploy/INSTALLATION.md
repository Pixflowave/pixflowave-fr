# Mise en ligne de pixflowave.fr sur le VPS (Ubuntu + nginx)

Le site est statique : nginx sert le dossier `/var/www/pixflowave.fr`.
À chaque `git push` sur `main`, GitHub construit le site et l'envoie dans ce dossier
(workflow `.github/workflows/deploy-vps.yml`).

L'envoi se fait avec un utilisateur dédié, **limité à ce seul dossier** (rrsync) :
la clé de déploiement stockée dans GitHub ne donne accès ni au reste du serveur
ni aux instances do.doc.

---

## 1. Sur le VPS : utilisateur et dossier du site

```bash
# Utilisateur de déploiement (sans mot de passe, connexion par clé uniquement)
sudo adduser --system --group --shell /bin/bash --home /home/deploy-pixflowave deploy-pixflowave

# Dossier du site
sudo install -d -o deploy-pixflowave -g deploy-pixflowave -m 755 /var/www/pixflowave.fr

# rrsync (fourni avec rsync) : doit répondre /usr/bin/rrsync
which rrsync
```

> Ubuntu 20.04 ou plus ancien : `rrsync` n'est pas installé directement.
> `sudo cp /usr/share/doc/rsync/scripts/rrsync /usr/bin/rrsync` (ou `gunzip -c …/rrsync.gz`),
> puis `sudo chmod 755 /usr/bin/rrsync`.

Si `/etc/ssh/sshd_config` contient une ligne `AllowUsers` ou `AllowGroups`,
y ajouter `deploy-pixflowave`, puis `sudo systemctl reload ssh`.

## 2. Sur le Mac : clé SSH dédiée au déploiement

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions pixflowave-fr" -f ~/.ssh/pixflowave_deploy
cat ~/.ssh/pixflowave_deploy.pub
```

## 3. Sur le VPS : autoriser cette clé, limitée au dossier du site

Remplacer `ssh-ed25519 AAAA…` par le contenu de `pixflowave_deploy.pub` :

```bash
sudo install -d -o deploy-pixflowave -g deploy-pixflowave -m 700 /home/deploy-pixflowave/.ssh
echo 'command="/usr/bin/rrsync /var/www/pixflowave.fr",restrict ssh-ed25519 AAAA… github-actions pixflowave-fr' \
  | sudo tee /home/deploy-pixflowave/.ssh/authorized_keys
sudo chown deploy-pixflowave:deploy-pixflowave /home/deploy-pixflowave/.ssh/authorized_keys
sudo chmod 600 /home/deploy-pixflowave/.ssh/authorized_keys
```

Test depuis le Mac (doit lister le dossier, vide pour l'instant, et rien d'autre) :

```bash
rsync -e "ssh -i ~/.ssh/pixflowave_deploy" deploy-pixflowave@IP_DU_VPS:/
```

## 4. Dans GitHub : les secrets

Dépôt **Pixflowave/pixflowave-fr** → *Settings* → *Secrets and variables* → *Actions* → *New repository secret* :

| Nom | Valeur |
|---|---|
| `VPS_HOST` | IP du VPS |
| `VPS_USER` | `deploy-pixflowave` |
| `VPS_SSH_KEY` | contenu de `~/.ssh/pixflowave_deploy` (la clé **privée**, tout le fichier) |
| `VPS_KNOWN_HOSTS` | résultat de `ssh-keyscan -t ed25519 IP_DU_VPS` |

Ensuite : onglet *Actions* → *Déploiement sur le VPS* → *Run workflow*.
Les fichiers doivent apparaître dans `/var/www/pixflowave.fr`.

## 5. Sur le VPS : configuration nginx

Copier `deploy/nginx/pixflowave.fr.conf` du dépôt vers le serveur, puis :

```bash
sudo cp pixflowave.fr.conf /etc/nginx/sites-available/pixflowave.fr
sudo ln -s /etc/nginx/sites-available/pixflowave.fr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Tester **avant** de changer le DNS (le domaine pointe encore vers WordPress) :

```bash
curl -I -H "Host: pixflowave.fr" http://IP_DU_VPS/
```

Ou, pour voir le site dans le navigateur : ajouter `IP_DU_VPS pixflowave.fr` dans
`/etc/hosts` sur le Mac, ouvrir http://pixflowave.fr, puis **retirer la ligne**.

## 6. Bascule : DNS chez IONOS

Quelques heures avant : baisser le TTL des enregistrements `A`/`AAAA` (ex. 300 s).

Dans l'espace IONOS → *Domaines* → *pixflowave.fr* → *DNS* :

- `A` `@` et `A` `www` → IP du VPS
- `AAAA` `@` et `www` → IPv6 du VPS, **ou supprimer** ces enregistrements si le VPS n'a pas d'IPv6
  (sinon une partie des visiteurs continuerait d'arriver sur l'ancien hébergement)
- **Ne pas toucher** aux enregistrements `MX` et `TXT` (spf) : ils font marcher l'e-mail.

Vérifier : `dig +short pixflowave.fr` doit renvoyer l'IP du VPS.

## 7. Sur le VPS : HTTPS (dès que le DNS pointe vers le VPS)

```bash
sudo apt install certbot python3-certbot-nginx   # si pas déjà installé
sudo certbot --nginx -d pixflowave.fr -d www.pixflowave.fr --redirect
```

Certbot ajoute le port 443 et la redirection http → https ; le renouvellement est automatique.

## 8. Après la bascule

- Désactiver l'aperçu GitHub Pages si on n'en veut plus
  (supprimer `.github/workflows/deploy.yml`, puis *Settings* → *Pages* → désactiver).
- Faire un **export complet du WordPress** (*Outils* → *Exporter*) et le garder hors du dépôt,
  puis résilier l'hébergement WordPress IONOS — en gardant le domaine et l'e-mail.
