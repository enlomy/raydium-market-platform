import { useState, useEffect } from "react";
import axios from "axios";
import { PublicKey } from "@solana/web3.js";
import { useWallet, WalletContextState, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Input, useDisclosure, Textarea, Switch, Button, Select, SelectItem, Divider, SelectedItems } from "@nextui-org/react";
import { mintToken, removeFreezeAuth, removeMintAuth, makeImmutableToken } from "@/lib/txHandler";
import { solanaConnection, devConnection, truncateText, getTokenList } from "@/lib/utils";
import { toast } from 'react-toastify';
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { SelectorIcon } from "@/components/SelectorIcon";
import SimpleBar from "simplebar-react";

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
  const [tokenList, setTokenList] = useState([]);
  const [mintLoading, setMintLoading] = useState(false);
  const [updateAuth, setUpdateAuth] = useState(true);
  const [updateTokenMint, setUpdateTokenMint] = useState("");
  const [rfToken, setRFToken] = useState("");
  const [rmToken, setRMToken] = useState("");
  const [imToken, setIMToken] = useState("");
  const [rfLoading, setRFLoading] = useState(false);
  const [rmLoading, setRMLoading] = useState(false);
  const [imLoading, setIMLoading] = useState(false);
  const [tokenMeta, setTokenMeta] = useState<any>();


  // Mint Section

  const [mintTokenSupply, setMintTokenSupply] = useState(100000);

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

  const changeUpadeteAuth = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setUpdateAuth(false);
        setUpdateTokenMint(mintAddress);
      } else {
        setUpdateTokenMint("");
        setUpdateAuth(true);
      }
      console.log("filter==>>", filtered);
    }
  }


  const changeRFAuth = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setUpdateAuth(false);
        setRFToken(mintAddress);
      } else {
        setRFToken("");
        setUpdateAuth(true);
      }
      console.log("filter==>>", filtered);
    }
  }

  const changeRMAuth = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setUpdateAuth(false);
        setRMToken(mintAddress);
      } else {
        setRMToken("");
        setUpdateAuth(true);
      }
      console.log("filter==>>", filtered);
    }
  }

  const changeIMAuth = async (mintAddress: string) => {
    const filtered: any = tokenList.filter((item: any) => item.mint == mintAddress);

    if (filtered.length > 0 && anchorWallet) {
      if (filtered[0].updateAuthority == anchorWallet.publicKey.toBase58()) {
        setTokenMeta(filtered[0]);
        setUpdateAuth(false);
        setIMToken(mintAddress);
      } else {
        setTokenMeta({});
        setIMToken("");
        setUpdateAuth(true);
      }
      console.log("filter==>>", filtered);
    }
  }

  const addToken = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }

    if (updateTokenMint == "") {
      toastError("You dont have authroiry for this token!")
      return;
    }

    setMintLoading(true);

    const tx = await mintToken({ mint: new PublicKey(updateTokenMint), url: "devnet", mintingAmount: mintTokenSupply, wallet: anchorWallet });

    if (tx) {
      if (anchorWallet) {
        try {
          let stx = (await anchorWallet.signTransaction(tx)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true,
          };

          const txId = await solanaConnection.sendRawTransaction(stx, options);
          await solanaConnection.confirmTransaction(txId, "confirmed");
          setMintLoading(false);
          toastSuccess(`${mintTokenSupply} token minted successfully!`);
          console.log("txId======>>", txId);

        } catch (error: any) {
          toastError(`${error.message}`);
          setMintLoading(false);
        }

      }
    }
  }

  const removeFreezeToken = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }

    if (rfToken == "") {
      toastError("You dont have authroiry for this token!")
      return;
    }

    setRFLoading(true);

    const tx = await removeFreezeAuth({ mint: new PublicKey(rfToken), url: "devnet", wallet: anchorWallet });

    if (tx) {
      if (anchorWallet) {
        try {
          let stx = (await anchorWallet.signTransaction(tx)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true,
          };

          const txId = await solanaConnection.sendRawTransaction(stx, options);
          await solanaConnection.confirmTransaction(txId, "confirmed");
          setRFLoading(false);
          toastSuccess(`Revoked freeze auth successfully!`);
          console.log("txId======>>", txId);

        } catch (error: any) {
          toastError(`${error.message}`);
          setRFLoading(false);
        }

      }
    }
  }

  const removeMintToken = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }

    if (rmToken == "") {
      toastError("You dont have authroiry for this token!")
      return;
    }

    setRMLoading(true);

    const tx = await removeMintAuth({ mint: new PublicKey(rmToken), url: "devnet", wallet: anchorWallet });

    if (tx) {
      if (anchorWallet) {
        try {
          let stx = (await anchorWallet.signTransaction(tx)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true,
          };

          const txId = await solanaConnection.sendRawTransaction(stx, options);
          await solanaConnection.confirmTransaction(txId, "confirmed");
          setRMLoading(false);
          toastSuccess(`Revoked freeze auth successfully!`);
          console.log("txId======>>", txId);

        } catch (error: any) {
          toastError(`${error.message}`);
          setRMLoading(false);
        }

      }
    }
  }

  const makeIMToken = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }

    if (imToken == "") {
      toastError("You dont have authroiry for this token!")
      return;
    }

    setIMLoading(true);

    const tx = await makeImmutableToken({ mint: new PublicKey(imToken), tokenMeta, url: "devnet", wallet: anchorWallet });

    if (tx) {
      if (anchorWallet) {
        try {
          let stx = (await anchorWallet.signTransaction(tx)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true,
          };

          const txId = await solanaConnection.sendRawTransaction(stx, options);
          await solanaConnection.confirmTransaction(txId, "confirmed");
          setIMLoading(false);
          toastSuccess(`Made the token immutable!`);
          console.log("txId======>>", txId);

        } catch (error: any) {
          toastError(`${error.message}`);
          setIMLoading(false);
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
        <div className=" w-full h-full p-5 bg-white rounded-xl justify-start flex items-start flex-col">
          <SimpleBar forceVisible="x" autoHide={true} className="w-full h-[700px] px-6">
            <span className="text-center w-full text-[25px] flex justify-center font-bold pt-8"> Token Mint</span>
            <div className=" w-full grid grid-cols-12 gap-4">
              <Select
                isRequired
                label="Token Address"
                placeholder="Select the Token"
                labelPlacement="outside"
                items={tokenList}
                className=" col-span-12"
                disableSelectorIconRotation
                selectorIcon={<SelectorIcon />}
                onChange={(e) => { changeUpadeteAuth(e.target.value); }}
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
              <Input
                isRequired
                type="number"
                radius="sm"
                defaultValue="100000"
                label="How much supply you want to mint:"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-12"
                onChange={(e) => { setMintTokenSupply(Number(e.target.value)); }}
              />
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button color="primary" isLoading={mintLoading} fullWidth className=" text-[18px]" onClick={() => { addToken() }}>
                  Mint Token
                </Button>
              </div>
            </div>
            <Divider className="w-full h-[2px] mt-6" />
            <span className="text-center w-full text-[25px] flex justify-center font-bold pt-8"> Revoke Freeze Authority</span>
            <div className=" w-full grid grid-cols-12 gap-4">
              <Select
                isRequired
                label="Token Address"
                placeholder="Select the Token"
                labelPlacement="outside"
                items={tokenList}
                className=" col-span-12"
                disableSelectorIconRotation
                selectorIcon={<SelectorIcon />}
                onChange={(e) => { changeRFAuth(e.target.value); }}
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
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button color="primary" isLoading={rfLoading} onClick={() => { removeFreezeToken() }} fullWidth className=" text-[18px]" >
                  Revoke Freeze
                </Button>
              </div>
            </div>
            <Divider className="w-full h-[2px] mt-6" />
            <span className="text-center w-full text-[25px] flex justify-center font-bold pt-8"> Revoke Mint Authority</span>
            <div className=" w-full grid grid-cols-12 gap-4 ">
              <Select
                isRequired
                label="Token Address"
                placeholder="Select the Token"
                labelPlacement="outside"
                items={tokenList}
                className=" col-span-12"
                disableSelectorIconRotation
                selectorIcon={<SelectorIcon />}
                onChange={(e) => { changeRMAuth(e.target.value); }}
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
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button color="primary" isLoading={rmLoading} fullWidth className=" text-[18px]" onClick={() => { removeMintToken() }}>
                  Revoke Mint
                </Button>
              </div>
            </div>
            <Divider className="w-full h-[2px] mt-6" />
            <span className="text-center w-full text-[25px] flex justify-center font-bold pt-8 "> Make Token Immutable</span>
            <div className=" w-full grid grid-cols-12 gap-4 ">
              <Select
                isRequired
                label="Token Address"
                placeholder="Select the Token"
                labelPlacement="outside"
                items={tokenList}
                className=" col-span-12"
                disableSelectorIconRotation
                selectorIcon={<SelectorIcon />}
                onChange={(e) => { changeIMAuth(e.target.value); }}
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
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button color="primary" isLoading={imLoading} fullWidth className=" text-[18px]" onClick={() => { makeIMToken() }}>
                  Make Token Immutable
                </Button>
              </div>
            </div>
          </SimpleBar>
        </div>
      </div>
    </main>
  );
}
