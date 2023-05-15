import { Mod } from "shapez/mods/mod";
import { ArchipelagoClient, CommandPacketType, ItemsHandlingFlags } from "archipelago.js";
import { v4 as uuidv4 } from 'uuid';
import { enumCategories } from "shapez/profile/application_settings";

const archipelagoSettingsCategory = "archipelago";

const SettingsExtension = ({ $super, $old }) => ({

    getCategoryButtonsHtml(){
        const archipelagoBtn = `<button class="styledButton categoryButton archipelagoSettingsBtn" data-category-btn="${archipelagoSettingsCategory}">Archipelago</button>`;
        return $old.getCategoryButtonsHtml() + archipelagoBtn;
    },

    getSettingsHtml(){
        const categoriesHTML = {};

        Object.keys(enumCategories).forEach(key => {
            const catName = enumCategories[key];
            categoriesHTML[catName] = `<div class="category" data-category="${catName}">`;
        });

        categoriesHTML[archipelagoSettingsCategory] = `<div class="category" data-category="${archipelagoSettingsCategory}">`;

        for (let i = 0; i < this.app.settings.settingHandles.length; ++i) {
            const setting = this.app.settings.settingHandles[i];
            if (!setting.categoryId) {
                continue;
            }

            categoriesHTML[setting.categoryId] += setting.getHtml(this.app);
        }

        categoriesHTML[archipelagoSettingsCategory] += `
        <div class="setting cardbox enabled">
            <div class="row">
                <label>Server Address</label>
                <div class="value text">
                    <input id="archpelagoServerAddress" class="archipelago-text-input" type="text" value="" />
                </div>
            </div>
        </div>
        <div class="setting cardbox enabled">
            <div class="row">
                <label>Server Port</label>
                <div class="value text">
                    <input id="archpelagoServerPort" class="archipelago-text-input" type="text" value="" />
                </div>
            </div>
        </div>
        <div class="setting cardbox enabled">
            <div class="row">
                <label>Slot Name</label>
                <div class="value text">
                    <input id="archpelagoSlotName" class="archipelago-text-input" type="text" value="" />
                </div>
            </div>
        </div>
        <div class="setting cardbox enabled">
            <div class="row">
                <label>Password</label>
                <div class="value text">
                    <input id="archpelagoPassword" class="archipelago-text-input" type="text" value="" />
                </div>
            </div>
        </div>
        <div class="setting cardbox enabled">
            <div class="row">
                <label>UUID</label>
                <div class="value text">
                    <input id="archpelagoUUID" class="archipelago-text-input" type="text" value="" disabled="disabled" />
                </div>
                <div class="desc">
                    TODO: Move to save settings...
                </div>
            </div>
        </div>
        <div class="setting cardbox enabled">
            <div class="row">
                <button id="archipelagoSaveBtn" class="styledButton archipelago-save-btn">Save/Connect</button>
            </div>
        </div>`;
        

        return Object.keys(categoriesHTML)
            .map(k => categoriesHTML[k] + "</div>")
            .join("");
    },

    initCategoryButtons() {
        Object.keys(enumCategories).forEach(key => {
            const category = enumCategories[key];
            const button = this.htmlElement.querySelector("[data-category-btn='" + category + "']");
            this.trackClicks(
                button,
                () => {
                    this.setActiveCategory(category);
                },
                { preventDefault: false }
            );
        });

        const category = archipelagoSettingsCategory;
        const button = this.htmlElement.querySelector("[data-category-btn='" + category + "']");
        this.trackClicks(
            button,
            () => {
                this.setActiveCategory(category);
            },
            { preventDefault: false }
        );
    }
});

class ArchipelagoMod extends Mod {
    init() {
        this.modInterface.extendClass(shapez.SettingsState, SettingsExtension);
        this.archipelagoClient = undefined;

        this.settings.archipelago_host ||= "archipelago.gg";
        this.settings.archipelago_port ||= "12345";
        this.settings.archipelago_slot ||= "";
        this.settings.archipelago_password ||= "";
        this.settings.archipelago_uuid ||= uuidv4();

        this.saveSettings();

        this.signals.gameStarted.add(state => {
            console.info("HI THIS IS THE gameStarted");
                
            //TODO: Make this smarter
            if(this.settings.archipelago_slot){
                if(this.archipelagoClient === undefined || this.archipelagoClient.status !== "Connected"){
                    this.archipelagoConnect();
                }
                console.dir(this.archipelagoClient);
            }else{
                this.dialogs.showInfo("Archipelago not Configured.", "Please fill out your config in the settings menu.");
            }
        });

        this.signals.stateEntered.add(state => {
            console.info("STATE ENTERED:");
            console.info(state);

            if (state instanceof shapez.MainMenuState) {

            }

            if (state.key === "SettingsState") {
                console.info("HI THIS IS THE SettingsState");

                const settings_host = document.querySelector("#archpelagoServerAddress");
                const settings_port = document.querySelector("#archpelagoServerPort");
                const settings_slot = document.querySelector("#archpelagoSlotName");
                const settings_password = document.querySelector("#archpelagoPassword");
                const settings_uuid = document.querySelector("#archpelagoUUID");

                settings_host.value = this.settings.archipelago_host;
                settings_port.value = this.settings.archipelago_port;
                settings_slot.value = this.settings.archipelago_slot;
                settings_password.value = this.settings.archipelago_password;
                settings_uuid.value = this.settings.archipelago_uuid;

                const settings_save_btn = document.querySelector("#archipelagoSaveBtn");
                settings_save_btn.addEventListener("click", () => {
                    console.info("Settings save clicked!");
                    const settings_host = document.querySelector("#archpelagoServerAddress");
                    const settings_port = document.querySelector("#archpelagoServerPort");
                    const settings_slot = document.querySelector("#archpelagoSlotName");
                    const settings_password = document.querySelector("#archpelagoPassword");
                    //const settings_uuid = document.querySelector("#archpelagoUUID");
                    this.settings.archipelago_host = settings_host.value;
                    this.settings.archipelago_port = settings_port.value;
                    this.settings.archipelago_slot = settings_slot.value;
                    this.settings.archipelago_password = settings_password.value;
                    //this.settings.archipelago_uuid = settings_uuid.value;
                    this.saveSettings();
                    this.archipelagoConnect(true);
                });

            }
        });
    }

    archipelagoConnect(fromSettings = false){
        console.info("Attempting to connect to Archipelago...");

        // Set up the AP client.
        this.archipelagoClient = new ArchipelagoClient(`${this.settings.archipelago_host}:${this.settings.archipelago_port}`);
        let credentials = {
            game: "Meritous",
            name: this.settings.archipelago_slot,
            uuid: this.settings.archipelago_uuid,
            version: { major: 0, minor: 4, build: 0 },
            items_handling: ItemsHandlingFlags.REMOTE_ALL,
        };

        if(this.settings.archipelago_password){
            credentials.password = this.settings.archipelago_password;
        };

        
        console.info(`${this.settings.archipelago_host}:${this.settings.archipelago_port}`);
        console.info(credentials);

        // Connect to the Archipelago server.
        this.archipelagoClient
            .connect(credentials)
            .then(() => {
                console.log(`Connected to room with ${this.archipelagoClient.data.players.size} players.`);

                if(fromSettings){
                    this.dialogs.showInfo("Archipelago Connected!", "Settings Saved");
                };

                // Send a raw packet to the server!
                //client.send({ cmd: CommandPacketType.SAY, text: "Hello, everybody!" });
            })
            .catch((err) => {
                console.error(err);
                this.dialogs.showInfo("Archipelago Error!", "Check your connection settings and make sure the game room is running.");
            });

        // Listen for packet events.
        this.archipelagoClient.addListener("printJSON", (_, message) => console.log(message));
    }
}
