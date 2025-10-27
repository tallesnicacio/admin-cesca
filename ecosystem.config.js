module.exports = {
  apps: [{
    name: 'admin-cesca',
    script: '/root/admin-cesca/start.sh',
    cwd: '/root/admin-cesca',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
