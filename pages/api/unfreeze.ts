// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from "next";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { createThawAccountInstruction } from "@solana/spl-token";
import base58 from "bs58";
import { sendMultiTx, connection } from '@/lib/utils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {

  try {
    if (req.method == "POST") {

      try {
        const { tokenAddress, updateAuthority } = req.body.params;
        const filePath = `./${tokenAddress}.json`;
        const tokenMint = new PublicKey(tokenAddress);
        const mainKp = Keypair.fromSecretKey(base58.decode(updateAuthority));
        const tokenMintMeta = await connection.getParsedAccountInfo(tokenMint);

        // @ts-ignore
        const freezeAuthority = tokenMintMeta.value?.data.parsed.info.freezeAuthority;

        if (freezeAuthority != mainKp.publicKey.toString()) {
          return res.status(400).json({ error: "The key pair does not match the token freeze authority." });
        }

        let thawAccounts: Array<any> = [];
        let completeAccounts: Array<any> = [];

        if (fs.existsSync(filePath)) {
          thawAccounts = JSON.parse(fs.readFileSync(filePath, `utf8`))
        } else {
          return res.status(200).json({ data: 0 });
        }

        const numIterations = Math.max(1, Math.ceil(thawAccounts.length / 20));

        for (let i = 0; i < numIterations; i++) {

          const tempArr = thawAccounts.slice(20 * i, 20 * (i + 1) - 1);

          let ixs: TransactionInstruction[] = [];
          console.log("tempArr==>>", tempArr);
          tempArr.map((item) => {
            ixs.push(createThawAccountInstruction(new PublicKey(item), tokenMint, mainKp.publicKey))
          });

          while (true) {
            try {
              await sendMultiTx(ixs, mainKp);
              completeAccounts = completeAccounts.concat(tempArr);
              break;
            } catch (err) {
              console.log("err->>", err);
              // res.status(500).json({ error: error.message });
            }
          }
        }

        const thawAccountSet = new Set(completeAccounts);
        const result = thawAccounts.filter(item => !thawAccountSet.has(item));

        const dataJson = JSON.stringify(result, null, 4);

        fs.writeFile(filePath, dataJson, (err) => {
          if (err) {
            console.log('Error writing file:', err);
          } else {
            console.log(`wrote file ${tokenAddress}.json`);
          }
        });

        return res.status(200).json({ data: completeAccounts.length });

      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }

    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
