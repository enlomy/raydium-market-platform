// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from "next";
import { connection } from '@/lib/utils';
import { getListenerId } from '@/lib/store';
import Tokens from '@/models/Tokens';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {

  try {
    if (req.method == "POST") {

      try {
        const { tokenAddress } = req.body.params;
        const filePath = `./${tokenAddress}.json`;
        const switchPath = `./switch.txt`;
        const connectionId = 0;

        fs.readFile(switchPath, 'utf8', (err, data) => {
          if (err) {
            console.error('Error reading the file:', err);
            return;
          }

          console.log('Original File Content:', data);

          // Modify the content (for example, appending some text)
          const newData = Number(data) + 1;

          // Write the new content back to the file
          fs.writeFile(switchPath, newData.toString(), 'utf8', (err) => {
            if (err) {
              console.error('Error writing to the file:', err);
              return;
            }

            console.log('File has been updated.');
          });
        });

        // await Tokens.updateOne(
        //   { token: 1 },
        //   { $inc: { processing: 1 }}
        // );

        let accountList: Array<any> = [];

        if (fs.existsSync(filePath)) {
          accountList = JSON.parse(fs.readFileSync(filePath, `utf8`))
        }

        return res.status(200).json({ data: accountList.length, message: "stopped", processId: connectionId });

      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }

    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
