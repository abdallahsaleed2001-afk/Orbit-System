import { Events } from 'discord.js';
import express from 'express';
import { registerSecurityDashboard } from '../services/security/securityDashboard.js';
import { logger, startupLog } from '../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    try {
      const server = client.webServer;
      const app = server?.listeners('request')?.[0];
      if (typeof app !== 'function') {
        logger.warn('Security dashboard could not attach: Express app was not found.');
        return;
      }

      app.use(express.json({ limit: '128kb' }));
      registerSecurityDashboard(app, client);

      if (!process.env.SECURITY_DASHBOARD_TOKEN) {
        logger.warn('SECURITY_DASHBOARD_TOKEN is not configured; /security will be inaccessible.');
      } else {
        startupLog('Security dashboard enabled at /security');
      }
    } catch (error) {
      logger.error('Failed to initialize security dashboard:', error);
    }
  },
};
