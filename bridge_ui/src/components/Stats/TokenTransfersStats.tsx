import {
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  ListItemText,
  makeStyles,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
  withStyles,
} from "@material-ui/core";
import { ToggleButton, ToggleButtonGroup } from "@material-ui/lab";
import { useCallback, useMemo, useState } from "react";
import { TIME_FRAMES } from "./Charts/TimeFrame";
import { ChainInfo, CHAINS_BY_ID, getChainShortName } from "../../utils/consts";
import { ChainId, CHAIN_ID_ETH } from "@certusone/wormhole-sdk";
import { COLORS } from "../../muiTheme";
import { ArrowBack, InfoOutlined } from "@material-ui/icons";
import useTokenTransfers from "../../hooks/useTokenTransfers";
import TokenTransfersSankeyChart from "./Charts/TokenTransfersSankeyChart";
import { createTokenTransfersChartData } from "./Charts/utils";

const useStyles = makeStyles((theme) => ({
  description: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "16px",
    [theme.breakpoints.down("xs")]: {
      flexDirection: "column",
    },
  },
  displayBy: {
    display: "flex",
    alignItems: "center",
    // justifyContent: "space-between",
    flexWrap: "wrap",
    marginBottom: "16px",
    [theme.breakpoints.down("xs")]: {
      justifyContent: "center",
      columnGap: 8,
      rowGap: 8,
    },
  },
  mainPaper: {
    display: "flex",
    flexDirection: "column",
    backgroundColor: COLORS.whiteWithTransparency,
    padding: "2rem",
    marginBottom: theme.spacing(8),
    borderRadius: 8,
  },
  toggleButton: {
    textTransform: "none",
  },
  tooltip: {
    margin: 8,
  },
  alignCenter: {
    margin: "0 auto",
    display: "block",
  },
}));

const tooltipStyles = {
  tooltip: {
    minWidth: "max-content",
    borderRadius: "4px",
    backgroundColor: "#5EA1EC",
    color: "#0F0C48",
    fontSize: "14px",
  },
};

const StyledTooltip = withStyles(tooltipStyles)(Tooltip);

const TokenTransfersStats = () => {
  const classes = useStyles();

  const [sourceChain, setSourceChain] = useState(CHAIN_ID_ETH);
  const [timeFrame, setTimeFrame] = useState("All time");

  const tokenTransfers = useTokenTransfers();

  const notionalTransferred = useMemo(() => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(
      tokenTransfers.data?.[timeFrame]?.[sourceChain]?.TotalNotionalTransferred || 0
    );
  }, [sourceChain, timeFrame, tokenTransfers]);

  const availableChains = useMemo(() => {
    const chainIds = tokenTransfers.data
      ? Object.keys(tokenTransfers.data["All time"] || {}).reduce<ChainId[]>(
          (chainIds, key) => {
            const chainId = parseInt(key) as ChainId;
            if (CHAINS_BY_ID[chainId]) {
              chainIds.push(chainId);
            }
            return chainIds;
          },
          []
        )
      : [];
    return chainIds;
  }, [tokenTransfers]);

  const chartData = useMemo(() => {
    return createTokenTransfersChartData(
      sourceChain,
      timeFrame,
      tokenTransfers.data || {}
    );
  }, [sourceChain, timeFrame, tokenTransfers]);

  const handleSourceChainChange = useCallback((event) => {
    setSourceChain(event.target.value);
  }, []);

  const handleTimeFrameChange = useCallback(
    (event) => setTimeFrame(event.target.value),
    []
  );

  return (
    <>
      <div className={classes.description}>
        <Typography variant="h3">
          Top assets bridged
          <StyledTooltip
            title={"TODO: tooltip text"}
            className={classes.tooltip}
          >
            <InfoOutlined />
          </StyledTooltip>
        </Typography>
        <Typography variant="h3">{notionalTransferred}</Typography>
      </div>
      <div className={classes.displayBy}>
        <Typography display="inline" style={{ marginRight: "8px" }}>
          Source chain
        </Typography>
        <TextField
          select
          variant="outlined"
          value={sourceChain}
          onChange={handleSourceChainChange}
          style={{ marginLeft: 8 }}
        >
          {availableChains.map((chainId) => (
            <MenuItem key={chainId} value={chainId}>
              {getChainShortName(chainId)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          variant="outlined"
          value={timeFrame}
          onChange={handleTimeFrameChange}
          style={{ marginLeft: "auto" }}
        >
          {Object.keys(TIME_FRAMES).map((timeFrame) => (
            <MenuItem key={timeFrame} value={timeFrame}>
              {timeFrame}
            </MenuItem>
          ))}
        </TextField>
      </div>
      <Paper className={classes.mainPaper}>
        {tokenTransfers.isFetching ? (
          <CircularProgress className={classes.alignCenter} />
        ) : (
          <TokenTransfersSankeyChart data={chartData} />
        )}
      </Paper>
    </>
  );
};

export default TokenTransfersStats;
