const path = require("path");
const AdmZip = require("adm-zip");
const fs = require("fs");
const packageTestService = require("../../utils/test/packageTestService");

const appServerlessDir = "../basic-app/.serverless";

const readJsonFile = filePath => {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
};

const readCloudFormationCreateTemplate = () => {
  return readJsonFile(
    `${appServerlessDir}/cloudformation-template-create-stack.json`
  );
};

const readCloudFormationUpdateTemplate = () => {
  return readJsonFile(
    `${appServerlessDir}/cloudformation-template-update-stack.json`
  );
};

describe("Package Tests", () => {
  describe("When no assetPrefix is configured in next.config", () => {
    beforeAll(() => {
      process.chdir(path.join(__dirname, "../basic-app"));
      packageTestService();
    });

    describe("CloudFormationTemplateCreate", () => {
      let cloudFormationTemplateCreate;
      let resources;

      beforeAll(() => {
        cloudFormationTemplateCreate = readCloudFormationCreateTemplate();
        resources = cloudFormationTemplateCreate.Resources;
      });

      it("should not have a static assets bucket", () => {
        expect(resources.NextStaticAssetsS3Bucket).not.toBeDefined();
      });
    });

    describe("CloudFormationTemplateUpdate", () => {
      let cloudFormationTemplateUpdate;
      let resources;

      beforeAll(() => {
        cloudFormationTemplateUpdate = readCloudFormationUpdateTemplate();
        resources = cloudFormationTemplateUpdate.Resources;
      });

      describe("Static assets bucket", () => {
        it("should not have a static assets bucket", () => {
          expect(resources.NextStaticAssetsS3Bucket).not.toBeDefined();
        });
      });

      describe("Page lambda functions", () => {
        let lambdaFunctions;

        beforeAll(() => {
          lambdaFunctions = {
            home: resources.HomePageLambdaFunction,
            about: resources.AboutPageLambdaFunction,
            post: resources.PostPageLambdaFunction,
            blog: resources.BlogPageLambdaFunction,
            fridges: resources.FridgesPageLambdaFunction
          };
        });

        it.each`
          pageName
          ${"home"}
          ${"about"}
          ${"blog"}
          ${"fridges"}
        `(
          "should create AWS Lambda resource for page $pageName",
          ({ pageName }) => {
            expect(lambdaFunctions[pageName].Type).toBeDefined();
            expect(lambdaFunctions[pageName].Type).toEqual(
              "AWS::Lambda::Function"
            );
          }
        );

        it.each`
          pageName     | handler
          ${"home"}    | ${"sls-next-build/home.render"}
          ${"about"}   | ${"sls-next-build/about.render"}
          ${"blog"}    | ${"sls-next-build/blog.render"}
          ${"fridges"} | ${"sls-next-build/categories/fridge/fridges.render"}
        `(
          "page $pageName should have handler $handler",
          ({ pageName, handler }) => {
            expect(lambdaFunctions[pageName].Properties.Handler).toEqual(
              handler
            );
          }
        );

        it("post page should have custom memorySize", () => {
          expect(lambdaFunctions["post"].Properties.MemorySize).toEqual(2048);
        });
      });

      describe("API gateway", () => {
        let apiGWPageResources;

        beforeAll(() => {
          apiGWPageResources = {
            home: resources.ApiGatewayResourceHome,
            about: resources.ApiGatewayResourceAbout,
            post: resources.ApiGatewayResourcePosts,
            blog: resources.ApiGatewayResourceBlog,
            fridges: resources.ApiGatewayResourceCategoriesFridgeFridges
          };
        });

        it.each`
          pageName
          ${"home"}
          ${"about"}
          ${"blog"}
          ${"fridges"}
        `(
          "should create api gateway resource for page $pageName",
          ({ pageName }) => {
            expect(apiGWPageResources[pageName]).toBeDefined();

            expect(apiGWPageResources[pageName].Type).toEqual(
              "AWS::ApiGateway::Resource"
            );
          }
        );

        it.each`
          pageName     | uri
          ${"home"}    | ${"home"}
          ${"about"}   | ${"about"}
          ${"blog"}    | ${"blog"}
          ${"fridges"} | ${"fridges"}
        `("page $pageName should have URI /$uri", ({ pageName }) => {
          expect(apiGWPageResources[pageName].Properties.PathPart).toEqual(
            pageName
          );
        });

        it("post page should have custom path and id parameter", () => {
          expect(apiGWPageResources["post"].Properties.PathPart).toEqual(
            "posts"
          );
          expect(
            resources.ApiGatewayResourcePostsIdVar.Properties.PathPart
          ).toEqual("{id}");
        });
      });
    });

    describe("Zip artifact", () => {
      it.each`
        compiledPage
        ${"sls-next-build/home"}
        ${"sls-next-build/about"}
        ${"sls-next-build/post"}
        ${"sls-next-build/blog"}
        ${"sls-next-build/categories/fridge/fridges"}
      `(
        "should contain $compiledPage js and $compiledPage original.js",
        ({ compiledPage }) => {
          const zip = new AdmZip(`${appServerlessDir}/basic-app.zip`);
          const zipEntries = zip.getEntries();
          const entryNames = zipEntries.map(ze => ze.entryName);

          expect(entryNames).toContain(`${compiledPage}.js`);
          expect(entryNames).toContain(`${compiledPage}.original.js`);
        }
      );
    });
  });

  describe("When assetPrefix is configured in next.config", () => {
    beforeAll(() => {
      process.env.ASSET_PREFIX = "https://s3.amazonaws.com/mybucket";
      packageTestService();
    });

    afterAll(() => {
      delete process.env.ASSET_PREFIX;
    });

    describe("CloudFormationTemplateCreate", () => {
      let cloudFormationTemplateCreate;
      let resources;

      beforeAll(() => {
        cloudFormationTemplateCreate = readCloudFormationCreateTemplate();
        resources = cloudFormationTemplateCreate.Resources;
      });

      // TODO: Un-skip after figuring out a way of making serverless
      // write user defined changes to cloudformation-template-create-stack.json
      it.skip("should have a static assets bucket", () => {
        expect(resources.NextStaticAssetsS3Bucket).toBeDefined();
      });
    });

    describe("CloudFormationTemplateUpdate", () => {
      let cloudFormationTemplateUpdate;
      let resources;

      beforeAll(() => {
        cloudFormationTemplateUpdate = readCloudFormationUpdateTemplate();
        resources = cloudFormationTemplateUpdate.Resources;
      });

      it("should have a static assets bucket", () => {
        expect(resources.NextStaticAssetsS3Bucket).toBeDefined();
      });
    });
  });
});
