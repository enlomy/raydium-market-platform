import { useState, useEffect } from "react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { Input, useDisclosure, Textarea, Switch, Button, Select, SelectItem, Divider } from "@nextui-org/react";
import { useWallet, WalletContextState, useAnchorWallet } from "@solana/wallet-adapter-react";
import { getPoolKeyInfo, addLiquidity, removeLiquidity } from "@/lib/txHandler";
import { getTokenMetadata, solanaConnection } from "@/lib/utils";
import { toast } from 'react-toastify';
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { CiCirclePlus } from "react-icons/ci";
import { getAssociatedTokenAddressSync } from '@solana/spl-token'

const toastError = (str: string) => {
  toast.error(str, {
    position: "top-center"
  });
}

const toastSuccess = (str: string) => {
  toast.success(str, {
    position: "top-center"
  });
}

export default function Home() {
  const wallet = useWallet();
  const anchorWallet = useAnchorWallet();
  const [tokenAddress, setTokenAddress] = useState("");
  const [lpWallet, setLpWallet] = useState("");
  const [keypair, setKeypair] = useState("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [started, setStarted] = useState(false);
  const [stopFlag, setStopFlag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [removeLpLoading, setRemoveLpLoading] = useState(false);

  // Mint Section
  const [lpAddress, setLpAddress] = useState("");
  const [removelpAddress, setRemoveLpAddress] = useState("");
  const [baseToken, setBaseToken] = useState<any>({
    tokenName: "",
    tokenSymbol: "",
    tokenLogo: ""
  });
  const [quoteToken, setQuoteToken] = useState<any>({
    tokenName: "",
    tokenSymbol: "",
    tokenLogo: ""
  });
  const [quoteAmount, setQuoteAmount] = useState(0);
  const [baseAmount, setBaseAmount] = useState(0);

  const [lpAmount, setLpAmount] = useState(0);
  const [orginalAmount, setOrginalAmount] = useState(0);

  const getPoolInfo = async () => {
    console.log("start=>>>");

    try {
      const res = await getPoolKeyInfo(new PublicKey(lpAddress), "devnet");
      if (res) {
        const base = await getTokenMetadata(res.baseMint.toBase58());
        console.log("base=>>>", base);

        setBaseToken(base);
        const quote = await getTokenMetadata(res.quoteMint.toBase58());
        setQuoteToken(quote);
      }
    } catch (error: any) {
      toastError(error.message);
      console.log(error);
    }
  }

  const getRemovePoolInfo = async () => {
    try {
      const res = await getPoolKeyInfo(new PublicKey(removelpAddress), "devnet");
      if (res && anchorWallet) {
        const tokenAccount = getAssociatedTokenAddressSync(res.lpMint, anchorWallet.publicKey);
        const tokenAccountInfo = await solanaConnection.getParsedAccountInfo(tokenAccount);

        if (tokenAccountInfo) {
          // @ts-ignore
          setLpAmount(tokenAccountInfo.value?.data.parsed.info.tokenAmount.uiAmount);
          // @ts-ignore
          setOrginalAmount(tokenAccountInfo.value?.data.parsed.info.tokenAmount.uiAmount);
        }

      }
    } catch (error: any) {
      toastError(error.message);
      console.log(error);
      return;
    }
  }


  const addLP = async () => {
    if (!anchorWallet) return;

    const processTransaction = async (amount: number, amountSide: "base" | "quote") => {
      setLoading(true);

      try {
        const res = await addLiquidity({
          poolId: new PublicKey(lpAddress),
          amount,
          amountSide,
          url: "devnet",
          wallet: anchorWallet
        });

        if (res) {
          const stx1 = (await anchorWallet.signTransaction(res)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true
          };

          const txId1 = await solanaConnection.sendRawTransaction(stx1, options);
          await solanaConnection.confirmTransaction(txId1, "confirmed");

          console.log("txId1======>>", txId1);
          toastSuccess(`${amountSide.charAt(0).toUpperCase() + amountSide.slice(1)} Token added to LP successfully!`);
        }
      } catch (error: any) {
        console.error("error====>>>", error);
        toastError(`${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    if (baseAmount > 0) {
      await processTransaction(baseAmount, "base");
    } else if (quoteAmount > 0) {
      await processTransaction(quoteAmount, "quote");
    }
  };

  const withdrawLP = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }

    if (lpAmount == 0) {
      toastError("LP amount must be greater than 0!")
      return;
    }

    setRemoveLpLoading(true);
    const res = await removeLiquidity({
      poolId: new PublicKey(removelpAddress),
      amount: lpAmount,
      url: "devnet",
      wallet: anchorWallet
    });
    if (res && anchorWallet) {
      try {
        let stx1 = (await anchorWallet.signTransaction(res)).serialize();

        const options = {
          commitment: "confirmed",
          skipPreflight: true,
        };

        const txId1 = await solanaConnection.sendRawTransaction(stx1, options);
        await solanaConnection.confirmTransaction(txId1, "confirmed");
        console.log("txId1======>>", txId1);
        toastSuccess(`LP Amount: ${lpAmount} has removed successfully!`);
        setRemoveLpLoading(false);
      } catch (error: any) {
        toastError(`${error.message}`);
        setRemoveLpLoading(false);
      }
    }
  }

  return (
    <main
      className={`flex flex-col min-h-screen px-16 py-6 bg-[#f0f4fd] font-IT w-full gap-5 h-screen`}
    >
      <Header />
      <div className=" w-full h-full flex gap-6">
        <ProSidebar />
        <div className=" w-full h-full p-5 bg-white rounded-xl justify-start flex items-center flex-col">
          <span className="text-center w-full text-[25px] flex justify-center font-bold"> Solana Liquidity Adder</span>
          <div className=" w-full grid grid-cols-12 gap-6 pt-5">
            <Input
              isRequired
              type="text"
              radius="sm"
              label="Enter Liquidity Address (AMM ID):"
              labelPlacement={'outside'}
              placeholder="Put the Liquidity Address"
              value={lpAddress}
              onChange={(e) => { setLpAddress(e.target.value); }}
              endContent={
                <div className=" flex gap-3 cursor-pointer" onClick={() => { getPoolInfo() }}>
                  <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center hover:bg-white" >
                    <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[rgb(252,220,77)] "></div>
                    Info
                  </div>

                </div>
              }
              className=" h-[40px] col-span-12"
            />
            <div className=" col-span-12 grid grid-cols-11 gap-5 ">
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Base Token Amount:"
                labelPlacement={'outside'}
                placeholder="Put the base token amount"
                className=" h-[40px] col-span-5"
                min={0}
                value={baseAmount.toString()}
                onChange={(e) => { setBaseAmount(Number(e.target.value)) }}
                endContent={
                  <div className=" flex gap-3 ">
                    {/* <div className=" flex gap-2 text-[13px]">
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#eee]"> Max</span>
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#eee]"> Half</span>
                    </div> */}
                    <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center h-fit" >
                      {baseToken.tokenLogo ? <img src={baseToken.tokenLogo} alt="" className="h-[20px] w-[20px]" /> : <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#fc4d4d]"></div>}
                      {baseToken.tokenSymbol ? baseToken.tokenSymbol : "Base"}
                    </div>

                  </div>
                }
              />
              <div className=" col-span-1 items-center justify-center flex mt-6">
                <CiCirclePlus className=" text-[40px]" />
              </div>
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Quote Token Amount:"
                labelPlacement={'outside'}
                placeholder="Put the quote token amount"
                className=" h-[40px] col-span-5"
                min={0}
                value={quoteAmount.toString()}
                onChange={(e) => { setQuoteAmount(Number(e.target.value)) }}
                endContent={
                  <div className=" flex gap-3">
                    {/* <div className=" flex gap-2 text-[13px]">
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#eee]"> Max</span>
                      <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#eee]"> Half</span>
                    </div> */}
                    <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center w-fit h-fit" >
                      {quoteToken.tokenLogo ? <img src={quoteToken.tokenLogo} alt="" className="h-[20px] w-[20px]" /> : <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#4d5ffc]"></div>}
                      {quoteToken.tokenSymbol ? quoteToken.tokenSymbol : "Quote"}
                    </div>
                  </div>
                }
              />
            </div>
            <div className=" flex w-full justify-center col-span-12 pt-5">
              <Button color="primary" fullWidth isLoading={loading} className=" text-[18px]" onClick={() => { addLP() }}>
                Add Liquidity
              </Button>
            </div>
          </div>
          <Divider className="w-full h-[2px] mt-6" />
          <span className="text-center w-full text-[25px] flex justify-center font-bold pt-20"> Solana Liquidity Remover</span>
          <div className=" w-full grid grid-cols-12 gap-6 pt-5">
            <Input
              isRequired
              type="text"
              radius="sm"
              label="Enter Liquidity Address (AMM ID):"
              labelPlacement={'outside'}
              placeholder="Put the Liquidity Address"
              className=" h-[40px] col-span-6"
              value={removelpAddress}
              onChange={(e) => { setRemoveLpAddress(e.target.value); }}
              endContent={
                <div className=" flex gap-3 cursor-pointer" onClick={() => { getRemovePoolInfo() }}>
                  <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center hover:bg-white" >
                    <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[rgb(252,220,77)] "></div>
                    Info
                  </div>

                </div>
              }
            />
            <Input
              isRequired
              fullWidth
              type="number"
              radius="sm"
              label="LP Token Amount:"
              labelPlacement={'outside'}
              // placeholder="Put the Liquidity Address"
              className=" h-[40px] col-span-6"
              min={0}
              value={lpAmount.toString()}
              onChange={(e) => { setLpAmount(Number(e.target.value)); }}
              startContent={
                <div className=" flex gap-3 ">
                  <div className=" border-[2px] px-2 py-[2px] rounded-md flex gap-2 items-center" >
                    <div className=" w-[10px] h-[10px] animate-pulse rounded-full bg-[#fc4d4d]"></div>
                    Base/Quote
                  </div>
                  <div className=" flex gap-2 text-[13px]">
                    <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#eee]" onClick={() => { setLpAmount(orginalAmount); }}> Max</span>
                    <span className=" p-1 px-3 rounded-2xl border-[2px] cursor-pointer hover:bg-[#eee]" onClick={() => { setLpAmount(orginalAmount / 2); }}> Half</span>
                  </div>

                </div>
              }
            />
            <div className=" flex w-full justify-center col-span-12 pt-5">
              <Button color="primary" isLoading={removeLpLoading} fullWidth className=" text-[18px]" onClick={() => { withdrawLP() }}>
                Withdraw Liquidity
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
