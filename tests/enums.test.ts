import { describe, it, expect } from 'vitest';
import {
  Codec,
  ExportServiceType,
  ExportTrunkType,
  IceMode,
  Pop,
  RtcpFeedbackMode,
  RtcpMuxMode,
  VoiceOutCodec,
} from '../src/enums.js';

// The wire values are the literals of the API document, in its order.
describe('enum wire values', () => {
  it('Codec lists the codecs of an inbound SIP configuration by name', () => {
    expect(Object.entries(Codec)).toEqual([
      ['TELEPHONE_EVENT', 'telephone_event'],
      ['G723', 'g723'],
      ['G729', 'g729'],
      ['PCMU', 'pcmu'],
      ['PCMA', 'pcma'],
      ['SPEEX', 'speex'],
      ['GSM', 'gsm'],
      ['G726_32', 'g726_32'],
      ['G721', 'g721'],
      ['G726_24', 'g726_24'],
      ['G726_40', 'g726_40'],
      ['G726_16', 'g726_16'],
      ['L16', 'l16'],
      ['AMR', 'amr'],
      ['AMR_WB', 'amr_wb'],
    ]);
  });

  it('VoiceOutCodec lists the codecs of a Voice OUT trunk', () => {
    expect(Object.entries(VoiceOutCodec)).toEqual([
      ['TELEPHONE_EVENT', 'telephone_event'],
      ['G723', 'g723'],
      ['G729', 'g729'],
      ['PCMU', 'pcmu'],
      ['PCMA', 'pcma'],
      ['GSM', 'gsm'],
      ['G722', 'g722'],
      ['OPUS', 'opus'],
      ['AMR', 'amr'],
      ['AMR_WB', 'amr_wb'],
    ]);
  });

  it.each([
    ['IceMode', IceMode],
    ['RtcpMuxMode', RtcpMuxMode],
    ['RtcpFeedbackMode', RtcpFeedbackMode],
  ])('%s is disabled, accept or initiate', (_name, mode) => {
    expect(Object.entries(mode)).toEqual([
      ['DISABLED', 'disabled'],
      ['ACCEPT', 'accept'],
      ['INITIATE', 'initiate'],
    ]);
  });

  it('Pop values are lowercase', () => {
    expect(Object.entries(Pop)).toEqual([
      ['NYC', 'nyc'],
      ['FRA', 'fra'],
      ['LAC', 'lac'],
      ['MIA', 'mia'],
      ['SG', 'sg'],
      ['HK', 'hk'],
      ['AMS', 'ams'],
    ]);
  });

  it('ExportTrunkType values are the trunk types of an sms_in export filter', () => {
    expect(Object.entries(ExportTrunkType)).toEqual([
      ['SMPP_SMSC', 'smpp_smsc'],
      ['SMPP_ESME', 'smpp_esme'],
      ['SMS_TO_EMAIL', 'sms_to_email'],
      ['HTTP_IN', 'http_in'],
    ]);
  });

  it('ExportServiceType values are the service types of an sms_out export filter', () => {
    expect(Object.entries(ExportServiceType)).toEqual([
      ['A2P', 'a2p'],
      ['P2P', 'p2p'],
    ]);
  });
});
