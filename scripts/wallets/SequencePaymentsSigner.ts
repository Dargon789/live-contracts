import { Wallet } from '@0xsequence/wallet'
import type { ethers } from 'ethers'
import { Orchestrator } from '@0xsequence/signhub'
import { commons, v2 } from '@0xsequence/core'
import { LocalRelayer } from '@0xsequence/relayer'
import ora from 'ora'

export type WalletType = Wallet<
  v2.config.WalletConfig,
  v2.signature.Signature,
  v2.signature.UnrecoveredSignature | v2.signature.UnrecoveredChainedSignature
>

export type SignerEnvironment = 'dev' | 'next' | 'prod'

type SignerDetails = {
  eoa: string
  expectedAddress: string
}

const SIGNER_DETAILS: Record<SignerEnvironment, SignerDetails> = {
  dev: {
    eoa: '0x508D3586Be412e0C3888f6ae11907473b4A1A381',
    expectedAddress: '0x40D9BDFfdF9409183fD6145b3e60c7d1beFf05fd'
  },
  next: {
    eoa: '0x26Dae5f5Df64dba75D5b6b31d64ab9292f42db38',
    expectedAddress: '0x51805F2d8719a833C28EAc68aE881B2Eb70c0330'
  },
  prod: {
    eoa: '0xd81aFb333fDA8A4A4E047EdeB0466884774774D4',
    expectedAddress: '0x9061a36CDBD17fFe8115aD34c85F94b624f0Dc0F'
  }
}

const createWalletConfig = (eoa: string) => {
  return v2.coders.config.fromSimple({
    threshold: 1,
    checkpoint: 0,
    signers: [
      {
        address: eoa,
        weight: 1
      }
    ]
  })
}

/**
 * Creates the payments signer Sequence wallet.
 * This wallet is the default signer for a sequence payments contract.
 */
export const deployPaymentsSigner = async (
  signerEnv: SignerEnvironment,
  relayer: ethers.Signer,
  context: commons.context.WalletContext,
  txParams?: ethers.providers.TransactionRequest
): Promise<WalletType> => {
  const { provider } = relayer
  if (!provider) {
    throw new Error('Relayer must be connected to a provider')
  }

  const o = ora().start(`Deploying ${signerEnv} payments signer wallet`)

  const { eoa, expectedAddress } = SIGNER_DETAILS[signerEnv]

  const walletConfig = createWalletConfig(eoa)
  const address = commons.context.addressOf(context, v2.coders.config.imageHashOf(walletConfig))
  if (address !== expectedAddress) {
    throw new Error(`Payments signer address for ${signerEnv} is not correct, expected ${expectedAddress}, got ${address}`)
  }

  const localRelayer = new LocalRelayer(relayer)
  if (txParams) {
    localRelayer.setTransactionOptions(txParams)
  }

  const wallet = new Wallet({
    coders: {
      signature: v2.signature.SignatureCoder,
      config: v2.config.ConfigCoder
    },
    context: context,
    config: walletConfig,
    chainId: (await provider.getNetwork()).chainId,
    address,
    orchestrator: new Orchestrator([]),
    provider,
    relayer: localRelayer
  })

  if (await wallet.reader().isDeployed(wallet.address)) {
    o.warn(`Already deployed ${signerEnv} payments signer wallet at ${wallet.address}`)
  } else {
    const tx = await wallet.deploy()
    if (!tx) {
      throw new Error(`Unable to deploy ${signerEnv} payments signer wallet at ${wallet.address}`)
    }
    await tx.wait()
  }

  o.succeed(`Deployed ${signerEnv} payments signer wallet at ${wallet.address}`)

  return wallet
}
