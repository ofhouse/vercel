import chalk from 'chalk';

import Client from '../../util/client';
import getScope from '../../util/get-scope';
import stamp from '../../util/output/stamp';
import createCertFromFile from '../../util/certs/create-cert-from-file';
import createCertForCns from '../../util/certs/create-cert-for-cns';
import { NowContext } from '../../types';
import { Output } from '../../util/output';
import { getCommandName } from '../../util/pkg-name';

interface Options {
  '--overwrite'?: boolean;
  '--debug'?: boolean;
  '--crt'?: string;
  '--key'?: string;
  '--ca'?: string;
}

async function add(
  ctx: NowContext,
  opts: Options,
  args: string[],
  output: Output
): Promise<number> {
  const {
    authConfig: { token },
    config,
  } = ctx;
  const { currentTeam } = config;
  const { apiUrl } = ctx;
  const addStamp = stamp();

  let cert;

  const {
    '--overwrite': overwite,
    '--debug': debugEnabled,
    '--crt': crtPath,
    '--key': keyPath,
    '--ca': caPath,
  } = opts;

  let contextName = null;
  const client = new Client({
    apiUrl,
    token,
    currentTeam,
    debug: debugEnabled,
  });

  try {
    ({ contextName } = await getScope(client));
  } catch (err) {
    if (err.code === 'NOT_AUTHORIZED' || err.code === 'TEAM_DELETED') {
      output.error(err.message);
      return 1;
    }

    throw err;
  }

  if (overwite) {
    output.error('Overwrite option is deprecated');
    client.close();
    return 1;
  }

  if (crtPath || keyPath || caPath) {
    if (args.length !== 0 || (!crtPath || !keyPath || !caPath)) {
      output.error(
        `Invalid number of arguments to create a custom certificate entry. Usage:`
      );
      output.print(
        `  ${chalk.cyan(
          `${getCommandName(
            'certs add --crt <domain.crt> --key <domain.key> --ca <ca.crt>'
          )}`
        )}\n`
      );
      client.close();
      return 1;
    }

    // Create a custom certificate from the given file paths
    cert = await createCertFromFile(client, keyPath, crtPath, caPath);
  } else {
    output.warn(
      `${chalk.cyan(
        getCommandName('certs add')
      )} will be soon deprecated. Please use ${chalk.cyan(
        getCommandName('certs issue <cn> <cns>')
      )} instead`
    );

    if (args.length < 1) {
      output.error(
        `Invalid number of arguments to create a custom certificate entry. Usage:`
      );
      output.print(
        `  ${chalk.cyan(getCommandName('certs add <cn>[, <cn>]'))}\n`
      );
      client.close();
      return 1;
    }

    // Create the certificate from the given array of CNs
    const cns = args.reduce<string[]>(
      (res, item) => res.concat(item.split(',')),
      []
    );
    const cancelWait = output.spinner(
      `Generating a certificate for ${chalk.bold(cns.join(', '))}`
    );

    cert = await createCertForCns(client, cns, contextName);
    cancelWait();
  }

  if (cert instanceof Error) {
    output.error(cert.message);
    return 1;
  } else {
    // Print success message
    output.success(
      `Certificate entry for ${chalk.bold(
        cert.cns.join(', ')
      )} created ${addStamp()}`
    );
  }

  return 0;
}

export default add;
