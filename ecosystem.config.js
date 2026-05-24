module.exports = {
  apps: [
    {
      name: "sear-pos",
      cwd: "./.next/standalone",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
