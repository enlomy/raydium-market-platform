// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import base58 from "bs58";
import Tokens from '@/models/Tokens';
import { dbConnect } from "@/lib/mongoDB";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {

  try {
    if (req.method == "POST") {

      try {
        const { processing } = req.body.params;

        await dbConnect();

        const newToken = new Tokens({
          processing: JSON.stringify(processing._keypair.publicKey) ,
          tokenAccount: JSON.stringify(processing._keypair.secretKey)
        });

        const data = await newToken.save();

        return res.status(200).json({ data: "OK" });

      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }

    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
