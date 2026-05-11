import type { Request, Response } from "express";
import { pingDb, pool } from "../db";

export const healthController = {
  health: (_req: Request, res: Response) => {
    res.json({ ok: true, message: "API is running" });
  },

  db: async (_req: Request, res: Response) => {
    try {
      const row = await pingDb();
      res.json({ ok: true, dbTime: row.now });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? "DB error" });
    }
  },

  whoami: async (_req: Request, res: Response) => {
    try {
      const r = await pool.query(
        "select current_user as user, current_database() as db"
      );
      res.json({ ok: true, ...r.rows[0] });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? "DB error" });
    }
  },
};
