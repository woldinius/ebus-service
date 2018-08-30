package de.benwol.smarthome.ebus.controller.comm;

import java.io.IOException;
import java.io.InputStream;

import org.junit.Test;

import gnu.io.SerialPort;

public class EBusSerialCommunicatorTest {

    private static final int SYN = -86;

    enum Mode {
        SYNC, DATA
    };

    EBusSerialCommunicator ebusSerialCommunicator;

    /** */
    public static class SerialReader implements Runnable {
        private InputStream in;
        private Mode mode;

        public SerialReader(InputStream in) {
            this.in = in;
            this.mode = Mode.SYNC;
        }

        /*
         * public void run() { int max = 1000; int i = 0; byte[] buffer = new
         * byte[1024]; int len = -1; try { StringBuffer uartbuffer = new StringBuffer();
         * while ((len = this.in.read(buffer)) > -1) { i++;
         * System.out.println("readed: " + new String(buffer, 0, len));
         * 
         * for (int j = 0; j < len; j++) { if (buffer[j] == -86) continue; String
         * transported = Integer.toBinaryString(buffer[j] & 255 | 256).substring(1);
         * transported.chars().sequential().boxed().forEach(c -> parse(c)); //
         * System.out.println(buffer[j] + " ->" + transported); //
         * uartbuffer.append(transported); } if (uartbuffer.length() > 0) { //
         * System.out.println("Message: " + uartbuffer.toString()); } uartbuffer = new
         * StringBuffer(); if (i >= max) break; }
         * 
         * } catch (
         * 
         * IOException e) { e.printStackTrace(); } }
         */
        public void run() {
            int max = 1000;
            int i = 0;
            byte[] buffer = new byte[1024];
            int len = -1;

            StringBuffer uartBuffer = new StringBuffer();

            try {

                while ((len = in.read(buffer)) > -1) {
                    i++;
                    for (int j = 0; j < len; j++) {

                        if (mode == Mode.DATA) {
                            if (buffer[j] == SYN) {
                                mode = Mode.SYNC;
                                parseMessage(uartBuffer.toString());
                                uartBuffer = new StringBuffer();
                            } else {
                                String transported = Integer.toBinaryString(buffer[j] & 255 | 256).substring(1);
                                System.out.println("append:" + buffer[j] + "->" + transported);
                                uartBuffer.append(transported);
                            }
                        }

                        if (mode == Mode.SYNC) {
                            if (buffer[j] != SYN) {
                                mode = Mode.DATA;
                                System.out.println();
                            } else {
                                String transported = Integer.toBinaryString(buffer[j] & 255 | 256).substring(1);
                                System.out.print(transported);
                            }
                        }

                    }
                    if (i >= max)
                        break;
                }

            } catch (IOException e) {
                e.printStackTrace();
            }
        }

        private void parseMessage(String bitString) {
            System.out.println("\nparseMessage(bitString=" + bitString + ").len=" + bitString.length());
            int i = 0;
            while (i < bitString.length()) {
                /*if (bitString.charAt(i) == '0') {
                    String databits = bitString.substring(i + 1, i + 9);
                    int intval = Integer.parseInt(databits, 2);
                    System.out.println(bitString.charAt(i) + " databits: " + databits + " -> " + intval + " hex:"
                            + Integer.toHexString(intval));
                    i += 10;
                } else {
                    i++;
                }*/
                String databits = bitString.substring(i , i + 8);
                int intval = Integer.parseInt(databits, 2);
                System.out.println("databits: " + databits + " -> " + intval + " hex:"
                        + Integer.toHexString(intval));
                i += 8;
            }

        }

    }

    @Test
    public void testSerialConnection() throws Exception {
        System.out.print("Testreader starting.");
        ebusSerialCommunicator = new EBusSerialCommunicator();
        System.out.print(".");
        SerialPort port = ebusSerialCommunicator.connect("COM5");
        System.out.println(".");

        new Thread(new SerialReader(port.getInputStream())).start();
        Thread.sleep(20000);
        System.out.println("Testreader started");
    }

}