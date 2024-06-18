// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from "next";
// import { saveDataToFile } from '@/lib/utils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {

  try {
    if (req.method == "POST") {

      try {
        const { tokenAddress } = req.body.params;
        // saveDataToFile(tokenAddress, "./auth.json")
        return res.status(200).json({ data: ""});

      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }

    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
