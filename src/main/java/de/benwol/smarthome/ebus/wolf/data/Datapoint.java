package de.benwol.smarthome.ebus.wolf.data;

import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@EqualsAndHashCode
public class Datapoint {
    private WolfDevice wolfDevice;
    private int DP_ID;
    private String datapointName;
    private String knxDatapointType;
    private boolean input;// false = output
    private String unit;

    public Datapoint(WolfDevice wolfDevice, int DP_ID, String datapointName, String knxDatapointType, boolean input,
            String unit) {
        this.wolfDevice = wolfDevice;
        this.DP_ID = DP_ID;
        this.datapointName = datapointName;
        this.knxDatapointType = knxDatapointType;
        this.input = input;
        this.unit = unit;
    }

}