module.exports = {
  apps: [
    {
      name: 'truma-server',
      cwd: './server',
      script: 'src/index.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'development',
      },
    },
    {
      name: 'truma-client',
      cwd: './client',
      script: 'node_modules/vite/bin/vite.js',
      interpreter: 'node',
      watch: false,
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
    },
  ],
};
