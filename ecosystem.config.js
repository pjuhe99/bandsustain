module.exports = {
  apps: [
    {
      name: "bandsustain",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      interpreter: "node",
      cwd: "/var/www/html/_______site_BANDSUSTAIN/public_html/bandsustain",
      env: {
        NODE_ENV: "production",
        PORT: 3100,
      },
    },
  ],
};
