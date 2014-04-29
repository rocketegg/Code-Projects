'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
  Schema = mongoose.Schema;


/**
 * Packet Schema
 *  Index:
 *    _id, timestamp, IP_ADDRESS
 *    If we can derive other device information like network region or
 *    similar, we can provide better metrics and should index on those as well
 *
 */
var PacketSchema = new Schema({
  /* Field Name: Timestamp
   * Lync: ConnectionInfo.TimeStamp
   */
  timestamp: {
    type: Date,
    default: Date.now
  },

  //These are properties about the data that are common to all incoming packets
  metadata: {
    /* Field Name: RTP Packet Count (received packets
     * Purpose: The difference between the last two reports received can be used to estimate the recent quality of the distribution.
     * Avaya: MID_RTP_PACKET_COUNT
     * Lync: QualityUpdate.Properties.PacketUtilization
     */
    PACKET_COUNT: {
      type: Number
    },

    /* Field Name: RTP Octet Count
     * Purpose: ??
     */
    OCTET_COUNT: {
      type: Number
    },

    /* Field Name: Average payload data rate
     * Purpose: Ratio of the average packet rate over an interval
     * Avaya: PACKET_COUNT(tn) - PACKET_COUNT(t0) / timestamp = rate
     * Lync: QualityUpdate.Properties.BitRateAvg
     */
    DATA_RATE: {
      type: Number
    },

    TYPE: {
      type:Number
    },

    LENGTH: {
      type:Number
    }
  },

  //placeholder for now
  data: {

  },

  //These are quality of service metrics that are specific to each vendor
  qos: {

    Avaya: {
      //Field Name: RTCP Round Trip Time
      MID_RTCP_RTT: {
        type: String
      },
      //Field Name: Jitter Buffer Delay
      MID_JITTER_BUFFER_DELAY: {
        type: String
      },
      //Field Name: Largest Sequence Jump
      MID_LARGEST_SEQ_JUMP: {
        type: String
      },
      //Field Name: Largest Sequence Fall
      MID_LARGEST_SEQ_FALL: {
        type: String
      },
      //Field Name: RSVP Status
      MID_RSVP_RECEIVER_STATUS: {
        type: String
      },
      //Field Name: Maximum Jitter
      MID_MAX_JITTER: {
        type: String
      },
      //Field Name: Jitter Buffer Underruns
      MID_JITTER_BUFFER_UNDERRUNS: {
        type: String
      },
      //Field Name: Jitter Buffer Overruns
      MID_JITTER_BUFFER_OVERRUNS: {
        type: String
      },
      //Field Name: Sequence Jump Instances
      MID_SEQ_JUMP_INSTANCES: {
        type: String
      },
      //Field Name: Sequence Fall Instances
      MID_SEQ_FALL_INSTANCES: {
        type: String
      },
      //Field Name: Echo Tail Length
      MID_ECHO_TAIL_LENGTH: {
        type: String
      },
      //Field Name: Remote IP Address & RTCP Port
      MID_ADDR_PORT: {
        type: String
      },
      //Field Name: RTP Payload Type
      MID_PAYLOAD_TYPE: {
        type: String
      },
      //Field Name: Frame Size
      MID_FRAME_SIZE: {
        type: String
      },
      //Field Name: Time To Live
      MID_RTP_TTL: {
        type: String
      },
      //Field Name: DiffServ Code Point
      MID_RTP_DSCP: {
        type: String
      },
      //Field Name: 802.1D
      MID_RTP_8021D: {
        type: String
      },
      //Field Name: Media Encryption
      MID_MEDIA_ENCYPTION: {
        type: String
      },
      //Field Name: Silence Suppression
      MID_SILENCE_SUPPRESSION: {
        type: String
      },
      //Field Name: Acoustic Echo Cancellation
      MID_ECHO_CANCELLATION: {
        type: String
      },
      //Field Name: Incoming Stream RTP Source Port
      MID_IN_RTP_SRC_PORT: {
        type: String
      },
      //Field Name: Incoming Stream RTP Destination Port
      MID_IN_RTP_DEST_PORT: {
        type: String
      }

    },

    Cisco: {

    },

    /* These are QOS metrics in a Lync packet
     * Lync: QualityUpdate.Properties
     */
    Lync: {
      Protocol: {
        type: String
      },
      EstimatedBandwidth: {
        Avg: {
          type: String
        },
        Low: {
          type: String
        },
        High: {
          type: String
        },
        Codec: {
          type: String
        }
      },
      ConversationalMOS: {
        type: String
      },
      PacketUtilization: {
        type: String
      },
      //xs:decimal
      PacketLossRate: {
        type: Number
      },
      PacketLossRateMax: {
        type: String
      },
      //xs:decimal
      JitterInterArrival: {
        type: String
      },
      JitterInterArrivalMax: {
        type: String
      },
      //xs:decimal
      RoundTrip: {
        type: Number
      },
      RoundTripMax: {
        type: String
      },
      HealerPacketDropRatio: {
        type: String
      },
      DegradationAvg: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      RatioConcealedSamplesAvg: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      EchoPercentMicIn: {
        type: String
      },
      EchoPercentSend: {
        type: String
      },
      EchoReturn: {
        type: String
      },
      EchoEventCauses: {
        type: String
      },
      RecvNoiseLevel: {
        type: String
      },
      RecvSignalLevel: {
        type: String
      },
      SampleRate: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      BurstDuration: {
        type: String
      },
      BurstDensity: {
        type: String
      },
      BurstGapDuration: {
        type: String
      },
      BurstGapDensity: {
        type: String
      },
      DegradationJitterAvg: {
        type: String
      },
      DegradationMax: {
        type: String
      },
      RecvListenMOSMin: {
        type: String
      },
      SendListenMOSMin: {
        type: String
      },
      SendListenMOS: {
        type: String
      },
      RecvListenMOS: {
        type: String
      },
      OverallMinNetworkMOS: {
        type: String
      },
      OverallAvgNetworkMOS: {
        type: String
      },
      DegradationPacketLossAvg: {
        type: String
      },
      VideoPacketLossRate: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      RecvFrameRateAverage: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      VideoLocalFrameLossPercentageAvg: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      DynamicCapabilityPercent: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      LowFrameRateCallPercent: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      LowResolutionCallPercent: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      VideoFrameLossRate: {
        type: String
      },
      LocalFrameLossPercentageAvg: {
        type: String
      },
      BitRateMax: {
        type: String
      },
      BitRateAvg: {
        type: String
      },
      VGAQualityRatio: {
        type: String
      },
      HDQualityRatio: {
        type: String
      },
      RelativeOneWayBurstDensity: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      RelativeOneWayAverage: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      RDPTileProcessingLatencyBurstDensity: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      RDPTileProcessingLatencyAverage: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      SpoiledTilePercentTotal: {
        //xs:decimal
        Limit: {
          type: Number
        }
      },
      //xs: decimal
      SpoiledTilePercentAverage: {
        type: Number
      },
      //xs: decimal
      FrameRate: {
        type: Number
      }
    }
  },

  //These fields are common to every data packet
  device: {
    /* 
     * Lync: QualityUpdate.From.IP
     */
    IP_ADDRESS: {
      type: String
    },

    /* Field Name: Canonical Name
     * Purpose: Identify device canonical name, this is a default field
     * in the RTCP header
     * Lync: QualityUpdate.From.Id
     */
    CNAME: {
      type: String
    },

    /* Field Name: Synchronization source
     */
    SSRC: {
      type: String
    }

  }
});


/**
 * Statics
 */
PacketSchema.statics = {
  load: function (id, cb) {
    this.findOne({
      _id: id
    }).exec(cb);
  },

  slice: function (startTime, endTime, density, cb) {
    endTime = new Date().getTime();
    console.log(new Date(endTime));
    this.find({
      timestamp: {
        $gte: startTime, 
        $lt: endTime
      }
    }).exec(cb);
  }
};

mongoose.model('Packet', PacketSchema);