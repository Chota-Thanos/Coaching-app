module.exports = {
  apps: [
    {
      name: "coaching-api",
      script: "npm",
      args: "run api:start",
      env: {
        NODE_ENV: "production",
        PORT: 4000
      }
    },
    {
      name: "coaching-web",
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 0.0.0.0 --port 3000",
      cwd: "./apps/web",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
