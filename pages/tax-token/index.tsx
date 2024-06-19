import { useState, useEffect } from "react";
import axios from "axios";
import { Keypair, PublicKey } from "@solana/web3.js";
import base58 from "bs58";
import { Input, useDisclosure, Textarea, Switch, Button, Select, SelectItem } from "@nextui-org/react";
import { AiOutlineLoading } from "react-icons/ai";
import { FaUpload } from "react-icons/fa6";
import { toast } from 'react-toastify';
import ProSidebar from "@/components/ProSidebar";
import Header from "@/components/Header";
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PINATA_API_KEY } from "@/lib/constant";
import ImageUploading from 'react-images-uploading';
import SimpleBar from 'simplebar-react';
import { createTaxToken } from "@/lib/txHandler";
import { solanaConnection } from "@/lib/utils";

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


  const [loading, setLoading] = useState(false);
  const [uploadingStatus, setUploadLoading] = useState(false);

  // Mint Section
  const [mintTokenName, setMintTokenName] = useState("");
  const [mintTokenSymbol, setTokenSymbol] = useState("");
  const [mintTokenDesc, setMintTokenDesc] = useState("");
  const [mintTokenSupply, setMintTokenSupply] = useState(1);
  const [mintTokenDecimal, setMintTokenDecimal] = useState(6);
  const [txFee, setTxFee] = useState(0);
  const [maxFee, setMaxFee] = useState(0);
  const [authWallet, setAuthWallet] = useState("");
  const [withdrawWallet, setWithdrawWallet] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [bearingRate, setBearingRate] = useState(0);
  const [metaDataURL, setMetaDataURL] = useState("");

  const [images, setImages] = useState([]);
  const [isSelected, setIsSelected] = useState(true);
  const [isTranserSelected, setIsTransferSelected] = useState(true);

  const maxNumber = 1;

  const onChange = (imageList: any, addUpdateIndex: any) => {
    // data for submit
    console.log(imageList, addUpdateIndex);
    setImages(imageList);
  };

  const pinataPublicURL = "https://gateway.pinata.cloud/ipfs/";

  const handleSetMetaData = async () => {
    setUploadLoading(true);
    // @ts-ignore
    const data = images.length > 0 ? images[0].file : null
    const imgData = new FormData();
    imgData.append("file", data);

    const imgRes = await fetch(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PINATA_API_KEY}`,
        },
        body: imgData,
      }
    );

    const imgJsonData = await imgRes.json()

    setMetaDataURL(pinataPublicURL + imgJsonData.IpfsHash)
    setUploadLoading(false);
    // setLoading(true);
    return pinataPublicURL + imgJsonData.IpfsHash;
  }

  const uploadJsonToPinata = async (jsonData: any) => {
    try {
      const response = await fetch(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          method: "POST",
          headers: {
            // Replace YOUR_PINATA_JWT with your actual JWT token
            Authorization: `Bearer ${PINATA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pinataContent: jsonData,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Uploaded JSON hash:", data.IpfsHash);
      return data.IpfsHash;
    } catch (error) {
      console.error("Error uploading JSON to Pinata:", error);
      throw error;
    }
  };

  const validator = async () => {
    if (!mintTokenName) {
      toastError("Please enter the token name");
      return false;
    }
    if (!mintTokenSymbol) {
      toastError("Please enter the token symbol");
      return false;
    }
    if (mintTokenDecimal <= 0) {
      toastError("Please enter a valid token decimal");
      return false;
    }
    if (mintTokenSupply <= 0) {
      toastError("Please enter a valid token supply");
      return false;
    }
    if (images.length === 0) {
      toastError("Please upload the token logo");
      return false;
    }
    if (!mintTokenDesc) {
      toastError("Please enter the token description");
      return false;
    }
    if (txFee < 0 || txFee >= 100) {
      toastError("Please select correct fee rate.");
      return false;
    }
    return true;
  }

  const createToken = async () => {
    if (!wallet.publicKey) {
      toastError("Wallet not connected!")
      return;
    }
    const validationFlag = await validator();
    if (validationFlag == false) {
      return;
    }

    // setLoading(true);

    const imgURL = await handleSetMetaData();
    const uploadedJsonUrl = await uploadJsonToPinata({
      name: mintTokenName,
      symbol: mintTokenSymbol,
      description: mintTokenDesc,
      image: imgURL
    });

    const tx = await createTaxToken({
      name: mintTokenName, symbol: mintTokenSymbol, decimals: mintTokenDecimal, url: "devnet", metaUri: pinataPublicURL + uploadedJsonUrl, initialMintingAmount: mintTokenSupply, feeRate: txFee, maxFee, authWallet: new PublicKey(authWallet), withdrawWallet: new PublicKey(withdrawWallet), useExtenstion: isSelected, permanentWallet: new PublicKey(permanentAddress), defaultAccountState: 1, bearingRate, transferable: isTranserSelected, wallet: anchorWallet
    });
    if (tx) {
      if (anchorWallet) {
        try {
          console.log("tx===========>>>>>>", tx);
          let stx = (await anchorWallet.signTransaction(tx)).serialize();

          const options = {
            commitment: "confirmed",
            skipPreflight: true,
          };

          const txId = await solanaConnection.sendRawTransaction(stx, options);
          await solanaConnection.confirmTransaction(txId, "confirmed");
          setLoading(false);
          toastSuccess(`${mintTokenName} token created successfully!`);
          console.log("txId======>>", txId);

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
        <div className=" w-full h-full p-5 bg-white rounded-xl justify-center flex items-center flex-col">
          <span className="text-center w-full text-[25px] flex justify-center font-bold"> Tax Token Creator</span>
          <SimpleBar forceVisible="x" autoHide={true} className="w-full h-[700px] px-6">
            <div className=" w-full grid grid-cols-12 gap-6 pt-10">
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Name:"
                labelPlacement={'outside'}
                placeholder="Put the name of your token"
                className=" h-[40px] col-span-6"
                onChange={(e) => { setMintTokenName(e.target.value); }}
              />
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Symbol:"
                labelPlacement={'outside'}
                className=" h-[40px]  col-span-6"
                placeholder="Put the symbol of your token"
                onChange={(e) => { setTokenSymbol(e.target.value); }}
              />
              <Input
                isReadOnly
                type="number"
                radius="sm"
                defaultValue="6"
                label="Decimals:"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-6"
                onChange={(e) => { setMintTokenDecimal(Math.floor(Number(e.target.value))); }}
              />
              <Input
                isRequired
                type="number"
                radius="sm"
                defaultValue="1"
                label="Supply:"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-6"
                onChange={(e) => { setMintTokenSupply(Math.floor(Number(e.target.value))); }}
              />
              <div className="flex flex-col gap-[6px] font-normal text-[14px] col-span-6 h-[225px]">
                <span>Image:</span>
                <ImageUploading
                  multiple
                  value={images}
                  onChange={onChange}
                  maxNumber={maxNumber}
                  dataURLKey="data_url"
                >
                  {({
                    imageList,
                    onImageUpload,
                    onImageRemoveAll,
                    onImageUpdate,
                    onImageRemove,
                    isDragging,
                    dragProps,
                  }) => (
                    // write your building UI
                    <div className="upload__image-wrapper w-full h-full">
                      {/* <button onClick={onImageRemoveAll}>Remove all images</button> */}
                      {imageList.length > 0 ? imageList.map((image, index) => (
                        <div key={index} className="image-item w-full justify-center items-center flex flex-col">
                          <img src={image['data_url']} alt="" className=" w-[150px] h-[150px] rounded-xl object-center" />
                          <div className="image-item__btn-wrapper w-full justify-center gap-[60px] flex">
                            <button onClick={() => onImageUpdate(index)} className=" hover:text-[#5680ce]">Update</button>
                            <button onClick={() => onImageRemove(index)} className=" hover:text-[#5680ce]">Remove</button>
                          </div>
                        </div>
                      )) : <button
                        style={isDragging ? { color: 'red' } : undefined}
                        onClick={onImageUpload}
                        className="bg-[#eee] w-full h-full flex justify-center items-center gap-3 flex-col rounded-xl"
                        {...dragProps}
                      >
                        <FaUpload fontSize={25} />
                        Click or Drop here
                      </button>}
                    </div>
                  )}
                </ImageUploading>
                <span className=" text-[12px]">Most meme coin use a squared 1000x1000 logo</span>
              </div>
              <div className=" w-full h-[200px] col-span-6">
                <Textarea
                  isRequired
                  fullWidth
                  classNames={{
                    innerWrapper: "h-[157px]"
                  }}
                  maxRows={8}
                  label="Description"
                  labelPlacement="outside"
                  placeholder="Enter your description"
                  onChange={(e) => { setMintTokenDesc(e.target.value); }}
                />
              </div>
              <Input
                isRequired
                type="number"
                radius="sm"
                label="Fee %: (10 = 10% per transaction):"
                placeholder="Put fee"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-6"
                min={0}
                max={99.9}
                defaultValue="0"
                onChange={(e) => { setTxFee(Number(e.target.value)); }}

              />
              <Input
                isRequired
                type="number"
                radius="sm"
                defaultValue="0 "
                label="Max Fee: (the maximum fee an user can pay in tokens):"
                placeholder="Put fee"
                labelPlacement={'outside'}
                className=" h-[40px] col-span-6"
                onChange={(e) => { setMaxFee(Number(e.target.value)); }}
              />
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Authority Wallet:"
                placeholder="Wallet Address"
                labelPlacement={'outside'}
                className=" h-[40px]  col-span-6"
                onChange={(e) => { setAuthWallet(e.target.value); }}
              />
              <Input
                isRequired
                type="text"
                radius="sm"
                label="Withdraw Authority: (wallet to withdraw fees):"
                placeholder="Wallet Address"
                labelPlacement={'outside'}
                className=" h-[40px]  col-span-6"
                onChange={(e) => { setWithdrawWallet(e.target.value); }}
              />
              <div className=" col-span-12">
                <Switch defaultSelected isSelected={isSelected} onValueChange={setIsSelected} size="sm">
                  <span className=" text-[14px]">Use Extensions</span>
                </Switch>
              </div>
              {isSelected ? <div className=" col-span-12 grid grid-cols-12 gap-4">
                <Input
                  type="text"
                  radius="sm"
                  label="Permanent Delegate:"
                  labelPlacement={'outside'}
                  placeholder="Permanent address"
                  className=" h-[40px] col-span-4"
                  onChange={(e) => { setPermanentAddress(e.target.value); }}
                />
                <Input
                  type="text"
                  radius="sm"
                  label="Default Account State:"
                  labelPlacement={'outside'}
                  placeholder="initialized"
                  className=" h-[40px] col-span-2"
                  isReadOnly
                />
                <Input
                  type="number"
                  radius="sm"
                  label="Interest Bearing Rate:"
                  labelPlacement={'outside'}
                  defaultValue="0"
                  placeholder="Put the rate"
                  className=" h-[40px] col-span-4"
                  onChange={(e) => { setBearingRate(Number(e.target.value)); }}
                />
                <div className=" col-span-2 items-end h-full flex justify-end">
                  <Switch defaultSelected isSelected={isTranserSelected} onValueChange={setIsTransferSelected} size="sm">
                    <span className=" text-[14px]">Non-Transferable</span>
                  </Switch>
                </div>
              </div> : null}
              <div className=" flex w-full justify-center col-span-12 pt-5">
                <Button color="primary" fullWidth className=" text-[18px]" onClick={() => { createToken() }} isLoading={uploadingStatus || loading}>
                  {uploadingStatus ? "Uploading Metadata" : loading ? "Creating Tax Token" : "Create Tax Token"}
                </Button>
              </div>
            </div>
          </SimpleBar>
        </div>
      </div>
    </main>
  );
}
