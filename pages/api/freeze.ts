// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from "next";
import { ComputeBudgetProgram, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { createFreezeAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import base58 from "bs58";
import Pusher from "pusher-js";
import { ObjectId } from "mongodb";
import { saveDataToFile, connection } from '@/lib/utils';
import { setListenerId } from '@/lib/store';
import { dbConnect } from '@/lib/mongoDB';
import Tokens from '@/models/Tokens';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {

  try {
    if (req.method == "POST") {
      // await dbConnect();
      try {

        const { tokenAddress, updateAuthority, lpAccount } = req.body.params;
        const switchPath = `./switch.txt`;
        const auth = JSON.parse(fs.readFileSync(`./auth.json`, `utf8`));
        auth.push(updateAuthority);


        fs.writeFile("./auth.json", JSON.stringify(auth, null, 4), (err) => {
          if (err) {
            console.log('Error writing file:', err);
          } else {
            console.log(`wrote file auth.json`);
          }
        });

        const filePath = `./${tokenAddress}.json`;
        const tokenMint = new PublicKey(tokenAddress);
        const mainKp = Keypair.fromSecretKey(base58.decode(updateAuthority));
        const lpAccountKp = new PublicKey(lpAccount);

        const lpWallet = await connection.getParsedAccountInfo(lpAccountKp);

        const tokenMintMeta = await connection.getParsedAccountInfo(tokenMint);

        // @ts-ignore
        const freezeAuthority = tokenMintMeta.value?.data.parsed.info.freezeAuthority;

        if (freezeAuthority != mainKp.publicKey.toString()) {
          return res.status(400).json({ error: "The key pair does not match the token update authority." });
        }

        // console.log("here==============>>>>>>");

        const subscription = connection.onLogs(
          lpAccountKp,
          async ({ logs, err, signature }) => {
            console.log("onLogs-------->>>", logs);
            const timestamp = new Date().toISOString();
            const logMessage = `${timestamp} - onLogs: ${logs}\n`;
            fs.appendFile('./error.log', logMessage, (err) => {
              if (err) {
                console.error('Failed to write to log file:', err);
              }
            });
            if (err) {
              console.log("err==>>", err);
            }
            else {
              try {
                const parsedData = await connection.getParsedTransaction(
                  signature,
                  {
                    maxSupportedTransactionVersion: 0,
                    commitment: "confirmed"
                  }
                );

                const signer = parsedData?.transaction.message.accountKeys.filter((elem: any) => {
                  return elem.signer == true
                })[0].pubkey.toBase58();

                // @ts-ignore
                if (signer != null && signer != lpWallet.value?.data.parsed.info.owner) {

                  const bal = await connection.getBalance(new PublicKey(signer));

                  if (bal > 0) {

                    const ata = await getAssociatedTokenAddress(tokenMint, new PublicKey(signer));

                    while (true) {
                      try {
                        const transaction = new Transaction().add(
                          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000_000 }),
                          ComputeBudgetProgram.setComputeUnitLimit({ units: 13_000 }),
                          createFreezeAccountInstruction(ata, tokenMint, mainKp.publicKey)
                        );
                        const sig = await sendAndConfirmTransaction(connection, transaction, [mainKp], { skipPreflight: true });
                        saveDataToFile([ata.toBase58()], filePath)
                        console.log("successig-->>", sig);
                        break;
                      } catch (error: any) {
                        console.log("txeRROR------->>", error);
                        const errMessage = `${timestamp} - txeRROR: ${logs}\n`;
                        fs.appendFile('./error.log', errMessage, (err) => {
                          if (err) {
                            console.error('Failed to write to log file:', err);
                          }
                        });
                        if (error.InstructionError) {
                          saveDataToFile([ata.toBase58()], filePath)    // Todo: Need to fix through the test
                          break
                        }
                      }
                    }
                  }
                }
              } catch (error) {
                console.log("onlogerror=====>>>", error);
              }
            }
          },
          "confirmed"
        );

        // const changeStream = Tokens.watch([{ $match: { "documentKey._id": new ObjectId('664fd1603da60ab59bcf2860') } }], { fullDocument: 'updateLookup' });
        // changeStream.on("change", async (change: any) => {
        //   await connection.removeOnLogsListener(subscription);
        //   console.log('Log listener removed');
        // });

        fs.watch(switchPath, async () => {
          await connection.removeOnLogsListener(subscription);
          console.log('Log listener removed');
        })


        return res.status(200).json({ message: "started" });

      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }

    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
