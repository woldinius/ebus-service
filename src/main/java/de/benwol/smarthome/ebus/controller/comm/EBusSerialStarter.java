package de.benwol.smarthome.ebus.controller.comm;

import java.io.IOException;
import java.io.InputStream;

import gnu.io.SerialPort;

public class EBusSerialStarter {
    /** */
    public static class SerialReader implements Runnable {
        InputStream in;

        public SerialReader(InputStream in) {
            this.in = in;
        }

        public void run() {
            int max = 1000;
            int i = 0;
            byte[] buffer = new byte[1024];
            int len = -1;
            try {
                while ((len = this.in.read(buffer)) > -1) {
                    i++;
                    System.out.print(new String(buffer, 0, len));
                    if (i >= max)
                        break;
                }
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    public static void main(String[] args) throws Exception {
        System.out.print("Testreader starting.");
        EBusSerialCommunicator ebusSerialCommunicator = new EBusSerialCommunicator();
        System.out.print(".");
        SerialPort port = ebusSerialCommunicator.connect("COM5");
        System.out.println(".");

        new Thread(new SerialReader(port.getInputStream())).start();
        Thread.sleep(10000);
        System.out.println("Testreader started");

    }

}