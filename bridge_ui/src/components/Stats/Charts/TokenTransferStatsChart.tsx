import { ChainId } from "@certusone/wormhole-sdk";
import { Grid, makeStyles, Typography } from "@material-ui/core";
import { ArrowForward } from "@material-ui/icons";
import { useMemo, useState } from "react";
import {
  Layer,
  Rectangle,
  ResponsiveContainer,
  Sankey,
  Tooltip,
} from "recharts";
import { TokenTransferStats } from "../../../hooks/useTokenTransferStats";
import { COIN_GECKO_IMAGE_URLS } from "../../../utils/coinGecko";
import {
  CHAINS_BY_ID,
  COLOR_BY_CHAIN_ID,
  getChainShortName,
} from "../../../utils/consts";
import { formatDate, formatTVL } from "./utils";

const useStyles = makeStyles(() => ({
  container: {
    padding: "16px",
    minWidth: "214px",
    background: "rgba(255, 255, 255, 0.95)",
    borderRadius: "4px",
  },
  titleText: {
    color: "#21227E",
    fontSize: "24px",
    fontWeight: 500,
  },
  ruler: {
    height: "3px",
    backgroundImage: "linear-gradient(90deg, #F44B1B 0%, #EEB430 100%)",
  },
  valueText: {
    color: "#404040",
    fontSize: "18px",
    fontWeight: 500,
  },
  icon: {
    width: "24px",
    height: "24px",
  },
  arrow: {
    color: "#5EA1EC",
  },
}));

interface ChartData {
  nodes: any[];
  links: any[];
}

const createChartData = (
  tokenTransferStats: TokenTransferStats,
  sourceChain: ChainId,
  timeFrame: string
) => {
  const sourceChainTransfers = Object.values(
    tokenTransferStats[timeFrame]?.[sourceChain]?.Transfers || {}
  ).sort((a, b) => b.NotionalTransferred - a.NotionalTransferred);

  // sort chains by notional transferred to
  const targetChainNotionals = sourceChainTransfers.reduce(
    (targetChainTotals, transfer) => {
      Object.entries(transfer.NotionalTransferredToChain).forEach(
        ([chainId, notional]) => {
          if (targetChainTotals[chainId] === undefined) {
            targetChainTotals[chainId] = notional;
          } else {
            targetChainTotals[chainId] += notional;
          }
        }
      );
      return targetChainTotals;
    },
    {} as { [chainId: string]: number }
  );

  const chartData: ChartData = { nodes: [], links: [] };
  const targetNodeIndexes = Object.entries(targetChainNotionals)
    .sort((a, b) => b[1] - a[1])
    // use the top 10 chains transferred to
    .slice(0, Math.min(10, Object.keys(targetChainNotionals).length))
    .reduce((targetNodeIndexes, value) => {
      const chainId = parseInt(value[0]) as ChainId;
      const chain = CHAINS_BY_ID[chainId];
      if (chain !== undefined) {
        chartData.nodes.push({
          name: getChainShortName(chainId),
          chainId,
          icon: chain.logo,
        });
        targetNodeIndexes[chainId] = chartData.nodes.length - 1;
      }
      return targetNodeIndexes;
    }, {} as { [chainId: string]: number });

  // create links from token transfers to chains
  return sourceChainTransfers.reduce((result, tokenTransfer) => {
    result.nodes.push({
      name: tokenTransfer.Name,
      tokenTransfer,
      icon: COIN_GECKO_IMAGE_URLS[tokenTransfer.CoinGeckoId],
    });
    const sourceNodeIndex = result.nodes.length - 1;
    Object.entries(tokenTransfer.NotionalTransferredToChain || {}).forEach(
      ([chainId, notional]) => {
        const target = targetNodeIndexes[chainId];
        if (target !== undefined) {
          result.links.push({
            source: sourceNodeIndex,
            target,
            value: notional,
          });
        }
      }
    );
    return result;
  }, chartData);
};

const truncateName = (name: string) => {
  return name.length > 15 ? `${name.substring(0, 13)}...` : name;
};

const CustomTooltip = ({ active, payload, title, valueFormatter }: any) => {
  const classes = useStyles();
  if (active && payload && payload.length) {
    console.log(payload);
    const { linkWidth } = payload[0].payload;
    if (linkWidth !== undefined) {
      const {
        value,
        source: { name, icon, tokenTransfer },
        target: { name: chainName, icon: chainIcon, chainId },
      } = payload[0].payload.payload;
      return (
        <div className={classes.container}>
          <Grid container alignItems="center">
            <img className={classes.icon} src={icon} alt="" />
            <Typography
              display="inline"
              className={classes.titleText}
              style={{ marginLeft: "8px" }}
            >
              {name}
            </Typography>
          </Grid>
          <Grid container alignItems="center">
            <ArrowForward
              className={classes.arrow}
              style={{ marginRight: "8px" }}
            />
            <img className={classes.icon} src={chainIcon} alt="" />
            <Typography
              display="inline"
              className={classes.titleText}
              style={{ marginLeft: "8px" }}
            >
              {chainName}
            </Typography>
          </Grid>
          <hr
            className={classes.ruler}
            style={{
              backgroundColor: COLOR_BY_CHAIN_ID[chainId as ChainId],
            }}
          />

          <Typography className={classes.valueText}>
            {valueFormatter(value)}
          </Typography>
          <Typography className={classes.valueText}>
            {/* {formatDate(payload[0].payload.date)} */}
          </Typography>
        </div>
      );
    }
    // } else if (depth === 0) {
    // const { tokenTransfer } = data;
    // console.log(tokenTransfer);
    // } else {
    // }
    // const { value } = payload[0];
    // const { tokenTransfer } = payload[0].payload.payload.source;
    // console.log(tokenTransfer);

    return (
      <div className={classes.container}>
        <Typography className={classes.titleText}>{title}</Typography>
        <hr className={classes.ruler}></hr>
        <Typography className={classes.valueText}>
          {/* {valueFormatter(value)} */}
        </Typography>
        <Typography className={classes.valueText}>
          {/* {formatDate(payload[0].payload.date)} */}
        </Typography>
      </div>
    );
  }
  return null;
};

const Link = ({
  sourceX,
  targetX,
  sourceY,
  targetY,
  sourceControlX,
  targetControlX,
  linkWidth,
  index,
}: any) => {
  const [opacity, setOpacity] = useState(0.5);

  sourceX += 310;
  targetX -= 300;
  sourceY -= 5;
  targetY -= 5;

  return (
    <Layer key={`Link${index}`}>
      <path
        d={`
            M${sourceX},${sourceY + linkWidth / 2}
            C${sourceControlX},${sourceY + linkWidth / 2}
              ${targetControlX},${targetY + linkWidth / 2}
              ${targetX},${targetY + linkWidth / 2}
            L${targetX},${targetY - linkWidth / 2}
            C${targetControlX},${targetY - linkWidth / 2}
              ${sourceControlX},${sourceY - linkWidth / 2}
              ${sourceX},${sourceY - linkWidth / 2}
            Z
          `}
        fill={"gray"}
        opacity={opacity}
        onMouseEnter={() => {
          setOpacity(1);
        }}
        onMouseLeave={() => {
          setOpacity(0.5);
        }}
      />
    </Layer>
  );
};

const Node = ({
  x,
  y,
  width,
  height,
  index,
  payload,
  sourceChainColor,
}: any) => {
  // TODO: useMemo?
  const isTokenNode = payload.tokenTransfer !== undefined;
  const logo = isTokenNode
    ? COIN_GECKO_IMAGE_URLS[payload.tokenTransfer.CoinGeckoId]
    : CHAINS_BY_ID[payload.chainId as ChainId]?.logo;
  const rectFill = isTokenNode
    ? sourceChainColor
    : COLOR_BY_CHAIN_ID[payload.chainId as ChainId];

  return (
    <Layer key={`Node${index}`}>
      <text
        textAnchor={isTokenNode ? "end" : "start"}
        x={isTokenNode ? x + 72 : x + width - 72}
        y={y + height / 2}
        fontSize="16"
        fill="white"
      >
        {formatTVL(payload.value)}
      </text>
      <text
        textAnchor={isTokenNode ? "end" : "start"}
        x={isTokenNode ? x + 224 : x + width - 224}
        y={y + height / 2}
        fontSize="16"
        fill="white"
      >
        {truncateName(payload.name)}
      </text>
      <image
        x={isTokenNode ? x + 250 : x - width - 250}
        y={y + height / 2 - 18}
        width={24}
        height={24}
        href={logo}
      />
      <Rectangle
        x={isTokenNode ? x + 300 : x + width - 300}
        y={y - 5}
        width={width}
        height={height}
        fill={rectFill}
      />
    </Layer>
  );
};

const TokenTransferStatsChart = ({
  tokenTransferStats,
  sourceChain,
  timeFrame,
}: {
  tokenTransferStats: TokenTransferStats;
  sourceChain: ChainId;
  timeFrame: string;
}) => {
  const data = useMemo(() => {
    return createChartData(tokenTransferStats, sourceChain, timeFrame);
  }, [tokenTransferStats, sourceChain, timeFrame]);

  const sourceChainColor = useMemo(() => {
    return COLOR_BY_CHAIN_ID[sourceChain];
  }, [sourceChain]);

  return (
    <ResponsiveContainer height={452}>
      <Sankey
        data={data}
        node={<Node sourceChainColor={sourceChainColor} />}
        link={<Link />}
        margin={{ top: 20, bottom: 20 }}
        nodePadding={32}
        iterations={0} // prevent Sankey component from rearranging the data
      >
        <Tooltip
          content={
            <CustomTooltip title={"Foobar"} valueFormatter={formatTVL} />
          }
        />
      </Sankey>
    </ResponsiveContainer>
  );
};

export default TokenTransferStatsChart;
