module.exports = {
  apps: [{
    name: 'web-staging',
    script: 'node_modules/.bin/serve',
    args: '-s dist -l 4001',
    cwd: '/opt/aksi-staging',
    autorestart: true,
  }],
};
