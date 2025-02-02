// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Base64DataBuffer, isSuiObject, isSuiMoveObject } from '@mysten/sui.js';
import BigNumber from 'bignumber.js';
import { useMemo } from 'react';

import { ReactComponent as ArrowRight } from '../../assets/SVGIcons/12px/ArrowRight.svg';

import { useGetObject } from '~/hooks/useGetObject';
import { Banner } from '~/ui/Banner';
import { AddressLink } from '~/ui/InternalLink';
import { Link } from '~/ui/Link';
import { PlaceholderTable } from '~/ui/PlaceholderTable';
import { TableCard } from '~/ui/TableCard';
import { Text } from '~/ui/Text';

const VALIDATORS_OBJECT_ID = '0x05';
const NUMBER_OF_VALIDATORS = 10;

export type ValidatorMetadata = {
    type: '0x2::validator::ValidatorMetadata';
    fields: {
        name: string;
        net_address: string;
        next_epoch_stake: number;
        pubkey_bytes: string;
        sui_address: string;
    };
};

export type Validator = {
    type: '0x2::validator::Validator';
    fields: {
        delegation: bigint;
        delegation_count: number;
        metadata: ValidatorMetadata;
        pending_delegation: bigint;
        pending_delegation_withdraw: bigint;
        pending_delegator_count: number;
        pending_delegator_withdraw_count: number;
        pending_stake: {
            type: '0x1::option::Option<0x2::balance::Balance<0x2::sui::SUI>>';
            fields: any;
        };
        pending_withdraw: bigint;
        stake_amount: bigint;
    };
};

export const STATE_DEFAULT: ValidatorState = {
    delegation_reward: 0,
    epoch: 0,
    id: { id: '', version: 0 },
    parameters: {
        type: '0x2::sui_system::SystemParameters',
        fields: {
            max_validator_candidate_count: 0,
            min_validator_stake: BigInt(0),
        },
    },
    storage_fund: 0,
    treasury_cap: {
        type: '',
        fields: {},
    },
    validators: {
        type: '0x2::validator_set::ValidatorSet',
        fields: {
            delegation_stake: BigInt(0),
            active_validators: [],
            next_epoch_validators: [],
            pending_removals: '',
            pending_validators: '',
            quorum_stake_threshold: BigInt(0),
            total_validator_stake: BigInt(0),
        },
    },
};

const textDecoder = new TextDecoder();

export type ObjFields = {
    type: string;
    fields: any;
};

export type SystemParams = {
    type: '0x2::sui_system::SystemParameters';
    fields: {
        max_validator_candidate_count: number;
        min_validator_stake: bigint;
    };
};

export type ValidatorState = {
    delegation_reward: number;
    epoch: number;
    id: { id: string; version: number };
    parameters: SystemParams;
    storage_fund: number;
    treasury_cap: ObjFields;
    validators: {
        type: '0x2::validator_set::ValidatorSet';
        fields: {
            delegation_stake: bigint;
            active_validators: Validator[];
            next_epoch_validators: Validator[];
            pending_removals: string;
            pending_validators: string;
            quorum_stake_threshold: bigint;
            total_validator_stake: bigint;
        };
    };
};

function StakeColumn(prop: { stake: bigint; stakePercent: number }) {
    return (
        <div className="flex items-end gap-0.5">
            <Text variant="bodySmall" color="steel-darker">
                {prop.stake.toString()}
            </Text>
            <Text variant="captionSmall" color="steel-dark">
                {prop.stakePercent.toFixed(2)}%
            </Text>
        </div>
    );
}

export function processValidators(set: Validator[], totalStake: bigint) {
    return set.map((av) => {
        const rawName = av.fields.metadata.fields.name;
        const name = textDecoder.decode(
            new Base64DataBuffer(rawName).getData()
        );
        return {
            name: name,
            address: av.fields.metadata.fields.sui_address,
            pubkeyBytes: av.fields.metadata.fields.pubkey_bytes,
            stake: av.fields.stake_amount,
            stakePercent: getStakePercent(av.fields.stake_amount, totalStake),
            delegation_count: av.fields.delegation_count || 0,
        };
    });
}

export const getStakePercent = (stake: bigint, total: bigint): number => {
    const bnStake = new BigNumber(stake.toString());
    const bnTotal = new BigNumber(total.toString());
    return bnStake.div(bnTotal).multipliedBy(100).toNumber();
};

const validatorsTable = (validatorsData: ValidatorState, limit?: number) => {
    const totalStake = validatorsData.validators.fields.total_validator_stake;

    const validators = processValidators(
        validatorsData.validators.fields.active_validators,
        totalStake
    ).sort((a, b) => (a.name > b.name ? 1 : -1));

    const validatorsItems = limit ? validators.splice(0, limit) : validators;

    return {
        data: validatorsItems.map((validator) => {
            return {
                name: (
                    <Text
                        variant="bodySmall"
                        color="steel-darker"
                        weight="medium"
                    >
                        {validator.name}
                    </Text>
                ),
                stake: (
                    <StakeColumn
                        stake={validator.stake}
                        stakePercent={validator.stakePercent}
                    />
                ),
                delegation: (
                    <Text variant="bodySmall" color="steel-darker">
                        {validator.stake.toString()}
                    </Text>
                ),
                address: (
                    <AddressLink
                        address={validator.address}
                        noTruncate={!limit}
                    />
                ),
            };
        }),
        columns: [
            {
                headerLabel: 'Name',
                accessorKey: 'name',
            },
            {
                headerLabel: 'Address',
                accessorKey: 'address',
            },
            {
                headerLabel: 'Stake',
                accessorKey: 'stake',
            },
        ],
    };
};

export function TopValidatorsCard({ limit }: { limit?: number }) {
    const { data, isLoading, isSuccess, isError } =
        useGetObject(VALIDATORS_OBJECT_ID);

    const validatorData =
        data && isSuiObject(data.details) && isSuiMoveObject(data.details.data)
            ? (data.details.data.fields as ValidatorState)
            : null;

    const tableData = useMemo(
        () => (validatorData ? validatorsTable(validatorData, limit) : null),
        [validatorData, limit]
    );

    if (isError || (!isLoading && !tableData?.data.length)) {
        return (
            <Banner variant="error" fullWidth>
                Validator data could not be loaded
            </Banner>
        );
    }

    return (
        <>
            {isLoading && (
                <PlaceholderTable
                    rowCount={limit || NUMBER_OF_VALIDATORS}
                    rowHeight="13px"
                    colHeadings={['Name', 'Address', 'Stake']}
                    colWidths={['220px', '220px', '220px']}
                />
            )}

            {isSuccess && tableData && (
                <>
                    <TableCard
                        data={tableData.data}
                        columns={tableData.columns}
                    />
                    {limit && (
                        <div className="mt-3">
                            <Link to="/validators">
                                <div className="flex items-center gap-2">
                                    More Validators{' '}
                                    <ArrowRight fill="currentColor" />
                                </div>
                            </Link>
                        </div>
                    )}
                </>
            )}
        </>
    );
}
