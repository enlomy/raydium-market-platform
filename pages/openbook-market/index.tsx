import { useState, useEffect } from "react";
import { Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { useWallet, WalletContextState, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Input, useDisclosure, Textarea, Switch, Button, Select, SelectItem, SelectedItems, Divider } from "@nextui-org/react";
import { toast } from 'react-toastify';
import { createMarket } from "@/lib/txHandler";
import { solanaConnection, devConnection, truncateText, getTokenList } from "@/lib/utils";
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { SelectorIcon } from "@/components/SelectorIcon";

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

const animals = [
  { key: "cat", label: "Cat" },
  { key: "dog", label: "Dog" },
  { key: "elephant", label: "Elephant" },
  { key: "lion", label: "Lion" },
  { key: "tiger", label: "Tiger" },
  { key: "giraffe", label: "Giraffe" },
  { key: "dolphin", label: "Dolphin" },
  { key: "penguin", label: "Penguin" },
  { key: "zebra", label: "Zebra" },
  { key: "shark", label: "Shark" },
  { key: "whale", label: "Whale" },
  { key: "otter", label: "Otter" },
  { key: "crocodile", label: "Crocodile" }
];

const standList = [
  { key: "0", label: "2.8 SOL" },
  { key: "1", label: "1.5 SOL" },
  { key: "2", label: "0.4 SOL" },
];

const lengthList = [
  { event: 2978, request: 63, order: 909 },
  { event: 1400, request: 63, order: 450 },
  { event: 128, request: 9, order: 201 }
];

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
  const [ltAddress, setLtAddress] = useState("FPtmoHC8vs7XuS67PqtxYBFnnERaEjQwv4H4UgBCsYRn");
  const [tokenList, setTokenList] = useState([]);

  // Mint Section
  const [baseToken, setBaseToken] = useState("");
  const [quoteToken, setQuoteToken] = useState("");
  const [orderSize, setMinOrderSize] = useState(1);
  const [tickSize, setTickSize] = useState(0.0001);
  const [standard, setStandard] = useState(1);
  const [eventLength, setEventLength] = useState(2978);
  const [requestLength, setRequestLength] = useState(63);
  const [orderBookLength, setOrderBookLength] = useState(909);

  // Launch Section
  const [launchTokenAmount, setLaunchTokenAmount] = useState(0);
  const [launchSolAmount, setLaunchSolAmount] = useState(0);
  const [launchPoolAccount, setLaunchPoolAccount] = useState("");
  const [launchFlag, setLaunchFlag] = useState(false);

  // Remove LP
  const [removeLPFlag, setRemoveLPFlag] = useState(false);

  // Sell Token
  const [sellAllFlag, setSellAllFlag] = useState(false);
  const [sellTokenAmount, setSellTokenAmount] = useState(0);
  const [sellAmountFlag, setSellAmountFlag] = useState(false);
  const [images, setImages] = useState([]);
  const [isSelected, setIsSelected] = useState(true);
  const [tokenAmount, setTokenAmount] = useState(1.00);
  const [solAmount, setSolAmount] = useState(0.0001000000);

  const changeAmount = async (type: number, direct: number) => {
    if (type == 0) {
      if (direct == 0) {
        setTokenAmount(tokenAmount + 1);
      } else setTokenAmount(tokenAmount - 1);
    } else {
      if (direct == 0) {
        setSolAmount(solAmount + 0.001);
      } else setSolAmount(solAmount - 0.001);
    }
  }

  const maxNumber = 1;

  const getNfts = async () => {
    if (!anchorWallet) return [];
    const list = await getTokenList(anchorWallet.publicKey);
    // console.log("list-=====>>>", list);
    setTokenList(list);
  };

  useEffect(() => {
    (async () => {
      await getNfts()
    })()
  }, [anchorWallet]);

  const changeQuote = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setQuoteToken(mintAddress);
      } else {
        setQuoteToken("");
      }
      console.log("filter==>>", filtered);
    }
  }

  const changeBase = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setBaseToken(mintAddress);
      } else {
        setBaseToken("");
      }
      console.log("filter==>>", filtered);
    }
  }

  const changeStandard = async (value: string) => {
    setEventLength(lengthList[Number(value)].event);
    setRequestLength(lengthList[Number(value)].request);
    setOrderBookLength(lengthList[Number(value)].order);
  }

  const createMarketTx = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }

    if (baseToken == "") {
      toastError("You shoule select base token!")
      return;
    }

    if (quoteToken == "") {
      toastError("You shoule select quote token!")
      return;
    }

    setLoading(true);
    const res = await createMarket({ baseMint: new PublicKey(baseToken), quoteMint: new PublicKey(quoteToken), url: "devnet", orderSize: orderSize, priceTick: tickSize, wallet: anchorWallet, eventLength, requestLength, orderBookLength });

    if (res) {
      console.log("res=====>>>>", res);
      if (anchorWallet) {
        try { 
          let stx1 = (await anchorWallet.signTransaction(res.tx1)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true,
          };

          const txId1 = await solanaConnection.sendRawTransaction(stx1, options);
          await solanaConnection.confirmTransaction(txId1, "confirmed");
          // toastSuccess(`${mintTokenSupply} token minted successfully!`);
          console.log("txId1======>>", txId1);
          
          let stx2 = (await anchorWallet.signTransaction(res.tx2)).serialize();

          const txId2 = await solanaConnection.sendRawTransaction(stx2, options);
          await solanaConnection.confirmTransaction(txId1, "confirmed");
          console.log("txId2======>>", txId2);

          toastSuccess(`${res.marketId} created successfully!`);

          setLoading(false);
        } catch (error: any) {
          toastError(`${error.message}`);
          setLoading(false);
        }
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
          <span className="text-center w-full text-[25px] flex justify-center font-bold">Create OpenBook Market</span>
          <div className=" w-full grid grid-cols-12 gap-6 pt-5">
            <Select
              isRequired
              label="Base Token"
              placeholder="Select the Token"
              labelPlacement="outside"
              items={tokenList}
              className=" col-span-6"
              disableSelectorIconRotation
              selectorIcon={<SelectorIcon />}
              onChange={(e) => { changeBase(e.target.value); }}
              renderValue={(items: SelectedItems<any>) => {
                return items.map((item: any) => (
                  <div key={item.data.mint} className="flex items-center gap-2 w-full justify-between font-IT">
                    <img src={item.data.image} alt="" className="w-[30px] h-[30px]" />
                    <div>
                      {/* {truncateText(item.data.mint, 10)} */}
                      {item.data.mint}
                    </div>
                    <div>
                      {item.data.symbol}
                    </div>
                  </div>
                ));
              }}
            >
              {(item) => (
                <SelectItem key={item.mint} textValue={item.updateAuthority}>
                  <div className=" flex w-full justify-between font-IT items-center">
                    <img src={item.image} alt="" className="w-[30px] h-[30px]" />
                    <div>
                      {/* {truncateText(item.mint, 4)} */}
                      {item.mint}
                    </div>
                    <div>
                      {item.symbol}
                    </div>
                  </div>
                </SelectItem>
              )}
            </Select>
            <Select
              isRequired
              label="Quote Token"
              placeholder="Select the Token"
              labelPlacement="outside"
              items={tokenList}
              className=" col-span-6"
              disableSelectorIconRotation
              selectorIcon={<SelectorIcon />}
              onChange={(e) => { changeQuote(e.target.value); }}
              renderValue={(items: SelectedItems<any>) => {
                return items.map((item: any) => (
                  <div key={item.data.mint} className="flex items-center gap-2 w-full justify-between font-IT">
                    <img src={item.data.image} alt="" className="w-[30px] h-[30px]" />
                    <div>
                      {/* {truncateText(item.data.mint, 10)} */}
                      {item.data.mint}
                    </div>
                    <div>
                      {item.data.symbol}
                    </div>
                  </div>
                ));
              }}
            >
              {(item) => (
                <SelectItem key={item.mint} textValue={item.updateAuthority}>
                  <div className=" flex w-full justify-between font-IT items-center">
                    <img src={item.image} alt="" className="w-[30px] h-[30px]" />
                    <div>
                      {/* {truncateText(item.mint, 4)} */}
                      {item.mint}
                    </div>
                    <div>
                      {item.symbol}
                    </div>
                  </div>
                </SelectItem>
              )}
            </Select>
            <div className=" col-span-12 grid grid-cols-12 gap-5 ">
              <div className=" col-span-6 h-[150px] rounded-xl bg-[#eee] flex justify-center items-center gap-7">
                {/* <CiSquarePlus className="text-[40px] cursor-pointer hover:text-[#5680ce]" onClick={() => { changeAmount(0, 0); }} /> */}
                <div className=" flex gap-4 justify-center items-center leading-none">
                  <span className=" text-[17px]"> Token</span>
                  <Input
                    type="number"
                    radius="sm"
                    defaultValue="1.00"
                    min="0"
                    step={1}
                    className=" h-[40px] col-span-3 w-[400px]"
                    onChange={(e) => { setMinOrderSize(Number(e.target.value)); }}
                  />
                </div>
                {/* <CiSquareMinus className="text-[40px] cursor-pointer hover:text-[#5680ce]" onClick={() => { changeAmount(0, 1); }} /> */}
              </div>

              <div className=" col-span-6 h-[150px] rounded-xl bg-[#eee] flex justify-center items-center gap-7">
                {/* <CiSquarePlus className="text-[40px] cursor-pointer hover:text-[#5680ce]" onClick={() => { changeAmount(1, 0); }} /> */}
                <div className=" flex gap-4 justify-center items-center leading-none">
                  <span className=" text-[17px]"> SOL</span>
                  <Input
                    type="number"
                    radius="sm"
                    defaultValue="0.0001000000"
                    step={0.0001}
                    min="0"
                    className=" h-[40px] col-span-3 w-[400px]"
                    onChange={(e) => { setTickSize(Number(e.target.value)); }}
                  />
                </div>
                {/* <CiSquareMinus className="text-[40px] cursor-pointer hover:text-[#5680ce]" onClick={() => { changeAmount(1, 1); }} /> */}
              </div>
            </div>

            <div className=" col-span-12">
              <Switch defaultSelected isSelected={isSelected} onValueChange={setIsSelected} size="sm">
                <span className=" text-[14px]">Advanced Options</span>
              </Switch>
            </div>
            {isSelected ? <div className=" col-span-12 grid grid-cols-12 gap-4">
              <Select
                isRequired
                defaultSelectedKeys="0"
                label="Select a standard OpenBook Market"
                labelPlacement="outside"
                className=" col-span-3"
                placeholder="Select the standard"
                disableSelectorIconRotation
                selectorIcon={<SelectorIcon />}
                onChange={(e) => { changeStandard(e.target.value) }}
              >
                {standList.map((stand) => (
                  <SelectItem key={stand.key}>
                    {stand.label}
                  </SelectItem>
                ))}
              </Select>
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Event Queue Length:"
                labelPlacement={'outside'}
                defaultValue="128"
                className=" h-[40px] col-span-3"
                value={eventLength.toString()}
              />
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Request Queue Length:"
                labelPlacement={'outside'}
                defaultValue="63"
                className=" h-[40px] col-span-3"
                value={requestLength.toString()}
              />
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Orderbook Length:"
                labelPlacement={'outside'}
                defaultValue="909"
                className=" h-[40px] col-span-3"
                value={orderBookLength.toString()}

              />
            </div> : null}
            <div className=" flex w-full justify-center col-span-12 pt-5">
              <Button color="primary" isLoading={loading} fullWidth className=" text-[18px]" onClick={() => { createMarketTx() }}>
                Create Martket
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
