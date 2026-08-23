module.exports = {
  apps: [{
    name: 'web-production',
    script: 'node_modules/.bin/serve',
    args: '-s dist -l 4000',
    cwd: '/opt/aksi-production',
    autorestart: true,
  }],
};
